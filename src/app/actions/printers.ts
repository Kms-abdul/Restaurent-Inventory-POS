'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addPrinter(formData: FormData) {
  const supabase = await createClient()

  const branch_id = formData.get('branch_id') as string
  const name = formData.get('name') as string
  const type = formData.get('type') as 'receipt' | 'kitchen'

  if (!branch_id || !name || !type) {
    throw new Error('All fields are required.')
  }

  const { data, error } = await supabase
    .from('printers')
    .insert({
      branch_id,
      name,
      type,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/super-admin/dashboard')
  revalidatePath(`/super-admin/restaurants`)
  return data
}

export async function deletePrinter(formData: FormData) {
  const supabase = await createClient()
  const printer_id = formData.get('printer_id') as string

  if (!printer_id) throw new Error('Printer ID is required')

  const { error } = await supabase
    .from('printers')
    .delete()
    .eq('id', printer_id)

  if (error) throw new Error(error.message)

  revalidatePath('/super-admin/dashboard')
  revalidatePath(`/super-admin/restaurants`)
}
