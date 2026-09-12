'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Update a restaurant admin's profile (name, phone).
 */
export async function updateRestaurantAdminProfile(formData: FormData) {
  const userId = formData.get('user_id') as string
  const name   = (formData.get('name')  as string)?.trim()
  const phone  = (formData.get('phone') as string)?.trim() || null

  if (!userId || !name) throw new Error('User ID and name are required.')

  const admin = getAdminClient()

  // Update profile
  const { error: profileError } = await admin
    .from('profiles')
    .update({ name, phone, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  // Update auth metadata too so it stays in sync
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { name },
  })

  revalidatePath('/super-admin/restaurant-admins')
  revalidatePath(`/super-admin/restaurant-admins/${userId}`)
}

/**
 * Update a restaurant admin's email address.
 */
export async function updateRestaurantAdminEmail(formData: FormData) {
  const userId = formData.get('user_id') as string
  const email  = (formData.get('email')  as string)?.trim().toLowerCase()

  if (!userId || !email) throw new Error('User ID and email are required.')

  const admin = getAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true, // immediately confirm the new email
  })

  if (error) throw new Error(error.message)

  revalidatePath('/super-admin/restaurant-admins')
  revalidatePath(`/super-admin/restaurant-admins/${userId}`)
}

/**
 * Set a new password for a restaurant admin.
 */
export async function updateRestaurantAdminPassword(formData: FormData) {
  const userId   = formData.get('user_id')  as string
  const password = formData.get('password') as string

  if (!userId || !password) throw new Error('User ID and password are required.')
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const admin = getAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) throw new Error(error.message)

  revalidatePath(`/super-admin/restaurant-admins/${userId}`)
}

/**
 * Toggle active/inactive status for a restaurant admin.
 */
export async function toggleRestaurantAdminStatus(formData: FormData) {
  const userId    = formData.get('user_id')   as string
  const isActive  = formData.get('is_active') === 'true'

  if (!userId) throw new Error('User ID is required.')

  const admin = getAdminClient()

  // Update profile is_active
  const { error: profileError } = await admin
    .from('profiles')
    .update({ is_active: !isActive })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  // Ban/unban in Supabase Auth
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: !isActive ? '0' : '876600h', // 100 years = effectively disabled
  })

  revalidatePath('/super-admin/restaurant-admins')
  revalidatePath(`/super-admin/restaurant-admins/${userId}`)
}

/**
 * Send a password reset email to a restaurant admin.
 */
export async function sendPasswordReset(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) throw new Error('Email is required.')

  const admin = getAdminClient()
  await admin.auth.admin.generateLink({ type: 'recovery', email })
}
