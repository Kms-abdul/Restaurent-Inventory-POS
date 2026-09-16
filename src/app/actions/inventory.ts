'use server'

import { createClient, getActionContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function listInventoryItems(branchId: string) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_current_stock')
    .select('*')
    .eq('branch_id', branchId)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInventoryItem(formData: FormData) {
  const ctx = await getActionContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { error } = await supabase.from('inventory_items').insert({
    restaurant_id: ctx.restaurantId,
    name: formData.get('name') as string,
    unit: formData.get('unit') as string,
    low_stock_threshold: Number(formData.get('low_stock_threshold') ?? 0),
    description: (formData.get('description') as string) || null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/restaurant/inventory')
}

export async function recordStockIn(data: {
  inventory_item_id: string
  branch_id: string
  quantity: number
  unit: string
  supplier?: string
  notes?: string
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { error } = await supabase.from('inventory_transactions').insert({
    inventory_item_id: data.inventory_item_id,
    branch_id: data.branch_id,
    transaction_type: 'purchase',
    quantity: Math.abs(data.quantity),  // always positive for stock in
    unit: data.unit,
    supplier: data.supplier ?? null,
    notes: data.notes ?? null,
    created_by: ctx.userId,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/restaurant/inventory')
}

export async function getTransactionHistory(inventoryItemId: string, branchId: string) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*, profiles(name)')
    .eq('inventory_item_id', inventoryItemId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function submitEODCount(data: {
  branch_id: string
  notes?: string
  items: {
    inventory_item_id: string
    expected_qty: number
    actual_qty: number
    adjustment_reason?: string
    notes?: string
  }[]
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = await createClient()

  // Create the stock count header
  const { data: countRow, error: countError } = await supabase
    .from('stock_counts')
    .insert({
      branch_id: data.branch_id,
      counted_by: ctx.userId,
      notes: data.notes ?? null,
    })
    .select('id')
    .single()

  if (countError) throw new Error(countError.message)

  // Insert count items
  const { error: itemsError } = await supabase.from('stock_count_items').insert(
    data.items.map(item => ({
      stock_count_id: countRow.id,
      inventory_item_id: item.inventory_item_id,
      expected_qty: item.expected_qty,
      actual_qty: item.actual_qty,
      adjustment_reason: item.adjustment_reason ?? null,
      notes: item.notes ?? null,
    }))
  )

  if (itemsError) throw new Error(itemsError.message)

  // Confirm the count (inserts adjustment transactions)
  const { error: confirmError } = await supabase.rpc('confirm_stock_count', {
    p_stock_count_id: countRow.id,
  })

  if (confirmError) throw new Error(confirmError.message)

  revalidatePath('/restaurant/inventory')
  return { stock_count_id: countRow.id }
}
