'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addPrinter(formData: FormData) {
  const supabase = await createClient()

  const branch_id    = formData.get('branch_id')    as string
  const windows_name = formData.get('windows_name') as string
  const label        = formData.get('label')        as string
  const printer_type = formData.get('printer_type') as 'receipt' | 'kitchen'

  if (!branch_id || !windows_name || !printer_type) {
    throw new Error('All fields are required.')
  }

  const { data, error } = await supabase
    .from('printers')
    .insert({
      branch_id,
      windows_name,
      label: label || windows_name,   // fallback label to the windows name
      printer_type,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/super-admin/restaurants')
  revalidatePath('/restaurant/branches')
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

  revalidatePath('/super-admin/restaurants')
}
