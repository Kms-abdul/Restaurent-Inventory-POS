'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function submitEODCountAction(data: {
  branch_id: string
  notes?: string
  items: {
    inventory_item_id: string
    expected_qty: number
    actual_qty: number
    variance_qty: number
    adjustment_reason?: string
    notes?: string
  }[]
}) {
  const ctx = await getUserContext()
  if (!ctx) throw new Error('Unauthorized')

  const admin = getAdminClient()

  // 1. Create the stock count record
  const { data: countRow, error: countError } = await admin
    .from('stock_counts')
    .insert({
      branch_id: data.branch_id,
      counted_by: ctx.userId,
      status: 'draft',
      notes: data.notes || null,
    })
    .select('id')
    .single()

  if (countError) throw new Error(countError.message)
  const stockCountId = countRow.id

  // 2. Insert items
  if (data.items.length > 0) {
    const itemRows = data.items.map(i => ({
      stock_count_id: stockCountId,
      inventory_item_id: i.inventory_item_id,
      expected_qty: i.expected_qty,
      actual_qty: i.actual_qty,
      adjustment_reason: i.adjustment_reason || 'wastage',
      notes: i.notes || null,
    }))

    const { error: itemsError } = await admin
      .from('stock_count_items')
      .insert(itemRows)

    if (itemsError) throw new Error(itemsError.message)
  }

  // 3. Confirm the stock count using the built-in database RPC
  const { error: confirmError } = await admin.rpc('confirm_stock_count', {
    p_stock_count_id: stockCountId,
  })

  if (confirmError) {
    // If the RPC fails, manually insert adjustment transactions
    console.warn('confirm_stock_count RPC warning:', confirmError)
    for (const item of data.items) {
      if (item.variance_qty !== 0) {
        await admin.from('inventory_transactions').insert({
          inventory_item_id: item.inventory_item_id,
          branch_id: data.branch_id,
          transaction_type: item.adjustment_reason === 'spoilage' ? 'spoilage' : 'wastage',
          quantity: item.variance_qty, // negative or positive adjustment
          unit: 'unit',
          notes: `EOD Count: ${item.notes || item.adjustment_reason || 'variance'}`,
          created_by: ctx.userId,
        })
      }
    }
  }

  revalidatePath('/restaurant/inventory')
  revalidatePath('/restaurant/inventory/audit')
  revalidatePath('/restaurant/dashboard')
  return { success: true, stock_count_id: stockCountId }
}
