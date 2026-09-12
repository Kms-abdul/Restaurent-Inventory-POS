import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { UserContext, PermissionKey } from '@/types/database'

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Run user membership & profile queries in parallel to drastically minimize latency
    const [profileRes, platformRes, restaurantRes, branchRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('platform_members').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('restaurant_members').select('restaurant_id, restaurants(*)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('branch_members').select(`
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
