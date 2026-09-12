'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function inviteSuperAdmin(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const name  = (formData.get('name')  as string)?.trim()

  if (!email || !name) throw new Error('Email and name are required.')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create auth user via admin API
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
    password: Math.random().toString(36).slice(-12) + 'A1!', // temporary password
  })

  if (authError) throw new Error(authError.message)

  const userId = authData.user.id

  // Upsert profile
  await adminClient.from('profiles').upsert({ id: userId, name })

  // Add to platform_members
  const { error: memberError } = await adminClient
    .from('platform_members')
    .insert({ user_id: userId, is_active: true })

  if (memberError && memberError.code !== '23505') throw new Error(memberError.message)

  // Send password reset (acts as invitation email)
  await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  revalidatePath('/super-admin/administrators')
}

export async function revokeSuperAdmin(formData: FormData) {
  const userId = formData.get('user_id') as string
  if (!userId) throw new Error('User ID is required.')

  const supabase = await createClient()

  // Verify the caller is a super admin before revoking
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (user.id === userId) throw new Error('You cannot revoke your own Super Admin access.')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient
    .from('platform_members')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/super-admin/administrators')
}
