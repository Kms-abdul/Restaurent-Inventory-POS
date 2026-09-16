'use server'

import { createServiceClient, getActionContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRestaurant(formData: FormData) {
  const ctx = await getActionContext()
  if (!ctx?.isSuperAdmin) throw new Error('Unauthorized')

  const restaurantName = formData.get('restaurant_name') as string
  const slug = formData.get('slug') as string
  const adminEmail = formData.get('admin_email') as string
  const adminName = formData.get('admin_name') as string
  const adminPassword = formData.get('admin_password') as string
  const branchName = formData.get('branch_name') as string
  const branchCity = formData.get('branch_city') as string

  const supabase = await createServiceClient()

  // 1. Create admin user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { name: adminName },
  })

  if (authError) throw new Error(authError.message)
  const adminUserId = authData.user!.id

  // 2. Call the atomic RPC
  const { data, error } = await supabase.rpc('create_restaurant_with_admin', {
    p_restaurant_name: restaurantName,
    p_restaurant_slug: slug,
    p_admin_user_id: adminUserId,
    p_branch_name: branchName || 'Main Branch',
    p_branch_city: branchCity || null,
    p_branch_address: null,
  })

  if (error) {
    // Cleanup: delete the auth user if restaurant creation failed
    await supabase.auth.admin.deleteUser(adminUserId)
    throw new Error(error.message)
  }

  revalidatePath('/super-admin/restaurants')
  return data as { restaurant_id: string; branch_id: string }
}

export async function listRestaurants() {
  const ctx = await getActionContext()
  if (!ctx?.isSuperAdmin) throw new Error('Unauthorized')

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, branches(count)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function toggleRestaurantActive(restaurantId: string, isActive: boolean) {
  const ctx = await getActionContext()
  if (!ctx?.isSuperAdmin) throw new Error('Unauthorized')

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('restaurants')
    .update({ is_active: isActive })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)
  revalidatePath('/super-admin/restaurants')
}
