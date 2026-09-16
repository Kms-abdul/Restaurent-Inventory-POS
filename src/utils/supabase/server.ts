import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { UserContext, PermissionKey } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// FAST AUTH CONTEXT (for Server Actions — minimal DB queries)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick auth check for Server Actions. Reads user JWT from Supabase session.
 * If the project has custom app_metadata claims (restaurant_id, branch_id),
 * those are returned directly with zero extra DB queries.
 * Otherwise falls back to a single parallel query for restaurant/branch membership.
 *
 * Use this in Server Actions instead of getUserContext() to avoid 4+ DB round-trips.
 */
export const getActionContext = cache(async (): Promise<{
  userId: string
  restaurantId: string | null
  branchId: string | null
  isSuperAdmin: boolean
} | null> => {
  try {
    const supabase = await createClient()
    // getSession() reads from the cookie — zero network cost (vs getUser() which hits Supabase auth server)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    const user = session.user

    // Try JWT claims first (zero DB cost) — set via Supabase custom claims / hooks
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    if (meta.restaurant_id || meta.branch_id || meta.is_super_admin) {
      return {
        userId: user.id,
        restaurantId: (meta.restaurant_id as string) ?? null,
        branchId: (meta.branch_id as string) ?? null,
        isSuperAdmin: !!(meta.is_super_admin),
      }
    }

    // Fallback: run only 2 parallel membership queries (vs 4 in getUserContext)
    const [platformRes, restaurantRes, branchRes] = await Promise.all([
      supabase.from('platform_members').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('restaurant_members').select('restaurant_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('branch_members').select('branch_id, branches(restaurant_id)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])

    if (platformRes.data) {
      return { userId: user.id, restaurantId: null, branchId: null, isSuperAdmin: true }
    }
    if (restaurantRes.data) {
      return { userId: user.id, restaurantId: restaurantRes.data.restaurant_id, branchId: null, isSuperAdmin: false }
    }
    if (branchRes.data) {
      const branch = branchRes.data.branches as any
      const restaurantId = Array.isArray(branch) ? branch[0]?.restaurant_id : branch?.restaurant_id
      return { userId: user.id, restaurantId: restaurantId ?? null, branchId: branchRes.data.branch_id, isSuperAdmin: false }
    }

    return { userId: user.id, restaurantId: null, branchId: null, isSuperAdmin: false }
  } catch (err) {
    console.warn('[getActionContext] error:', err)
    return null
  }
})

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies set in middleware
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { }
        },
      },
    }
  )
}

/**
 * Loads the full UserContext for the currently authenticated user.
 * Memoized per request using React cache() and queries fetched concurrently.
 */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  try {
    const supabase = await createClient()

    // Use getSession() to read from cookie (zero network cost) to get userId,
    // then verify + fetch all membership data in ONE parallel batch
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    const user = session.user

    // Fast path: if JWT app_metadata has claims, skip ALL DB membership queries
    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    const hasJwtClaims = !!(meta.restaurant_id || meta.branch_id || meta.is_super_admin)

    // Run all membership + profile queries in parallel in a single batch
    const [profileRes, platformRes, restaurantRes, branchRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      hasJwtClaims && meta.is_super_admin
        ? Promise.resolve({ data: { id: 'jwt' }, error: null })
        : supabase.from('platform_members').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      hasJwtClaims && meta.restaurant_id
        ? supabase.from('restaurants').select('*').eq('id', meta.restaurant_id as string).maybeSingle().then(r => ({ data: r.data ? { restaurant_id: meta.restaurant_id, restaurants: r.data } : null, error: r.error }))
        : supabase.from('restaurant_members').select('restaurant_id, restaurants(*)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      hasJwtClaims && meta.branch_id
        ? supabase.from('branch_members').select(`branch_id, role_id, branches(*, restaurants(*)), roles(role_permissions(permission))`).eq('branch_id', meta.branch_id as string).eq('user_id', user.id).eq('is_active', true).maybeSingle()
        : supabase.from('branch_members').select(`
        branch_id,
        role_id,
        branches(*, restaurants(*)),
        roles(role_permissions(permission))
      `).eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])

    let profile = profileRes.data

    // Self-healing: if the user exists in auth but their profile was missing, recreate it
    if (!profile) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: newProfile, error: insertError } = await adminSupabase
        .from('profiles')
        .insert({
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown User',
        })
        .select('*')
        .single()

      if (insertError) {
        console.warn('Failed to auto-create profile:', insertError)
        return null
      }
      profile = newProfile
    }

    const platformMember = platformRes.data
    const isSuperAdmin = !!platformMember

    if (isSuperAdmin) {
      return {
        userId: user.id,
        profile,
        isSuperAdmin: true,
        restaurantId: null,
        restaurant: null,
        branchId: null,
        branch: null,
        roleId: null,
        permissions: new Set<PermissionKey>(),
      }
    }

    const restaurantMember = restaurantRes.data
    if (restaurantMember) {
      const restaurant = Array.isArray(restaurantMember.restaurants)
        ? restaurantMember.restaurants[0]
        : restaurantMember.restaurants

      return {
        userId: user.id,
        profile,
        isSuperAdmin: false,
        restaurantId: restaurantMember.restaurant_id,
        restaurant: restaurant ?? null,
        branchId: null,
        branch: null,
        roleId: null,
        permissions: new Set<PermissionKey>(),
      }
    }

    const branchMember = branchRes.data
    if (branchMember) {
      const branch = Array.isArray(branchMember.branches)
        ? branchMember.branches[0]
        : branchMember.branches

      const restaurant = branch
        ? (Array.isArray((branch as any).restaurants)
          ? (branch as any).restaurants[0]
          : (branch as any).restaurants)
        : null

      const rolePerms = Array.isArray(branchMember.roles)
        ? branchMember.roles[0]?.role_permissions ?? []
        : (branchMember.roles as any)?.role_permissions ?? []

      const permissions = new Set<PermissionKey>(
        rolePerms.map((rp: { permission: string }) => rp.permission as PermissionKey)
      )

      return {
        userId: user.id,
        profile,
        isSuperAdmin: false,
        restaurantId: restaurant?.id ?? null,
        restaurant: restaurant ?? null,
        branchId: branchMember.branch_id,
        branch: branch ?? null,
        roleId: branchMember.role_id,
        permissions,
      }
    }

    return {
      userId: user.id,
      profile,
      isSuperAdmin: false,
      restaurantId: null,
      restaurant: null,
      branchId: null,
      branch: null,
      roleId: null,
      permissions: new Set<PermissionKey>(),
    }
  } catch (err) {
    console.warn('[getUserContext] DB error:', err)
    return null
  }
})
