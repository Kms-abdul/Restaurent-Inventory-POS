'use server'

import { createClient, createServiceClient, getActionContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CartItem, PaymentMode } from '@/types/database'

/**
 * Create a KOT print job so the local Print Agent picks it up and
 * prints silently to the thermal printer — no browser dialog.
 */
export async function createKOTPrintJob(params: {
  branchId: string
  orderId: string
  orderNo: number
  restaurantName: string
  branchName: string
  cashierName: string
  tableNumber?: string
  notes?: string
  items: { name: string; qty: number; notes?: string }[]
}) {
  const ctx = await getActionContext()
  if (!ctx) return // silent — don't block checkout

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()

  const payload = {
    restaurant_name: params.restaurantName,
    branch_name:     params.branchName,
    order_no:        params.orderNo,
    cashier_name:    params.cashierName,
    table_number:    params.tableNumber ?? null,
    created_at:      new Date().toISOString(),
    order_notes:     params.notes ?? null,
    items: params.items.map(i => ({
      name:  i.name,
      qty:   i.qty,
      notes: i.notes ?? null,
    })),
  }

  await supabase.from('print_jobs').insert({
    branch_id:    params.branchId,
    order_id:     params.orderId,
    printer_type: 'kitchen',
    payload,
    status:       'pending',
    copies:       1,
  })
  // intentionally no throw — print job failure must not block checkout
}


export async function createPOSOrder(params: {
  branchId: string
  restaurantId: string
  tableNumber?: string
  paymentMode: PaymentMode
  totalAmount: number
  discountAmount?: number
  notes?: string
  items: CartItem[]
}) {
  // Use fast context (1 DB query max vs 5 in getUserContext)
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  // Client-side idempotency key: branch + timestamp + random
  const clientRef = `${params.branchId}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const isZeroTotal = params.totalAmount === 0
  // When total is 0 (e.g. relative order or 100% discount), pass 'none' to RPC to bypass payment table check constraint (amount > 0)
  const effectivePaymentMode = isZeroTotal ? 'none' : params.paymentMode

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  const { data, error } = await supabase.rpc('create_pos_order_v2', {
    p_client_ref: clientRef,
    p_branch_id: params.branchId,
    p_restaurant_id: params.restaurantId,
    p_table_number: params.tableNumber ?? null,
    p_payment_mode: effectivePaymentMode,
    p_total_amount: params.totalAmount,
    p_discount_amount: params.discountAmount ?? 0,
    p_terminal_id: null,
    p_notes: params.notes ?? null,
    p_items: params.items.map(item => ({
      menu_item_id: item.menuItemId,
      item_name: item.name,
      category: item.category,
      unit_price: item.unitPrice,
      qty: item.qty,
      line_total: item.lineTotal,
      notes: item.notes ?? null,
    })),
  })

  if (error) throw new Error(error.message)

  const result = data as { order_id: string; order_no: number; idempotent: boolean }

  // If order was 100% complimentary / zero total, mark as settled immediately
  if (isZeroTotal && result?.order_id) {
    await supabase
      .from('orders')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
        payment_mode: params.paymentMode || 'cash',
      })
      .eq('id', result.order_id)
  }

  // Automatically queue KOT in Supabase print_jobs for the 2nd floor printer bridge
  if (result?.order_id) {
    try {
      void createKOTPrintJob({
        branchId: params.branchId,
        orderId: result.order_id,
        orderNo: result.order_no,
        restaurantName: 'CHINESE NAWAB',
        branchName: '',
        cashierName: 'POS Staff',
        tableNumber: params.tableNumber,
        notes: params.notes,
        items: params.items.map(i => ({ name: i.name, qty: i.qty, notes: i.notes })),
      })
    } catch (e) {
      console.warn('Failed to queue print job:', e)
    }
  }

  // Only revalidate the POS page — dashboard picks it up on next natural visit
  revalidatePath('/staff/pos')
  return result
}

/**
 * KOT: Create an active order (no payment) and queue a KOT print job.
 * Used when cashier taps "KOT" — chef cooks, customer pays later.
 */
export async function createKOTOrder(params: {
  branchId: string
  restaurantId: string
  tableLabel?: string   // e.g. "Table 4" or "Dine-in"
  notes?: string
  items: CartItem[]
  restaurantName?: string
  branchName?: string
  cashierName?: string
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const clientRef = `${params.branchId}-kot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const totalAmount = params.items.reduce((sum, i) => sum + i.lineTotal, 0)

  // Build combined notes
  let combinedNotes = params.notes?.trim() ?? ''
  if (params.tableLabel) {
    combinedNotes = combinedNotes
      ? `${combinedNotes} [${params.tableLabel}]`
      : `[${params.tableLabel}]`
  }

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  const { data, error } = await supabase.rpc('create_pos_order_v2', {
    p_client_ref: clientRef,
    p_branch_id: params.branchId,
    p_restaurant_id: params.restaurantId,
    p_table_number: params.tableLabel ?? null,
    p_payment_mode: 'none',
    p_total_amount: totalAmount,
    p_discount_amount: 0,
    p_terminal_id: null,
    p_notes: combinedNotes || null,
    p_items: params.items.map(item => ({
      menu_item_id: item.menuItemId,
      item_name: item.name,
      category: item.category,
      unit_price: item.unitPrice,
      qty: item.qty,
      line_total: item.lineTotal,
      notes: item.notes ?? null,
    })),
  })

  if (error) throw new Error(error.message)

  const result = data as { order_id: string; order_no: number; idempotent: boolean }

  // Queue KOT print job
  if (result?.order_id) {
    try {
      void createKOTPrintJob({
        branchId: params.branchId,
        orderId: result.order_id,
        orderNo: result.order_no,
        restaurantName: params.restaurantName ?? 'RESTAURANT',
        branchName: params.branchName ?? '',
        cashierName: params.cashierName ?? 'Staff',
        tableNumber: params.tableLabel,
        notes: combinedNotes || undefined,
        items: params.items.map(i => ({ name: i.name, qty: i.qty, notes: i.notes })),
      })
    } catch (e) {
      console.warn('KOT print job failed:', e)
    }
  }

  revalidatePath('/staff/pos')
  return result
}

/**
 * HOLD: Create an active order, print KOT to kitchen (chef cooks immediately),
 * but do NOT settle. The order stays open so more items can be added later.
 */
export async function holdOrder(params: {
  branchId: string
  restaurantId: string
  tableLabel?: string
  notes?: string
  items: CartItem[]
  restaurantName?: string
  branchName?: string
  cashierName?: string
}) {
  // HOLD behaves identically to KOT on the server side — the distinction is
  // that the UI keeps the order in a "Hold Tray" and doesn't clear the active session.
  return createKOTOrder({
    ...params,
    notes: params.notes
      ? `[HOLD] ${params.notes}`
      : '[HOLD]',
  })
}

/**
 * Add more items to an existing active (held) order and queue an incremental KOT.
 */
export async function addItemsToHeldOrder(params: {
  orderId: string
  branchId: string
  newItems: CartItem[]
  restaurantName?: string
  branchName?: string
  cashierName?: string
  tableLabel?: string
  orderNo: number
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()

  // Insert new order_items rows
  const itemRows = params.newItems.map(item => ({
    order_id: params.orderId,
    menu_item_id: item.menuItemId || null,
    item_name_at_sale: item.name,
    category_at_sale: item.category || 'General',
    unit_price_at_sale: item.unitPrice,
    qty: item.qty,
    line_total: item.lineTotal,
    notes: item.notes ?? null,
  }))

  const { error: insertError } = await supabase.from('order_items').insert(itemRows)
  if (insertError) throw new Error(insertError.message)

  // Recalculate total_amount for the order
  const { data: allItems, error: fetchError } = await supabase
    .from('order_items')
    .select('line_total')
    .eq('order_id', params.orderId)

  if (fetchError) throw new Error(fetchError.message)

  const newTotal = (allItems ?? []).reduce((sum, row) => sum + (row.line_total ?? 0), 0)

  const { error: updateError } = await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', params.orderId)

  if (updateError) throw new Error(updateError.message)

  // Queue incremental KOT print for only the new items
  try {
    void createKOTPrintJob({
      branchId: params.branchId,
      orderId: params.orderId,
      orderNo: params.orderNo,
      restaurantName: params.restaurantName ?? 'RESTAURANT',
      branchName: params.branchName ?? '',
      cashierName: params.cashierName ?? 'Staff',
      tableNumber: params.tableLabel,
      notes: `[ADD-ON] Order #${params.orderNo}`,
      items: params.newItems.map(i => ({ name: i.name, qty: i.qty, notes: i.notes })),
    })
  } catch (e) {
    console.warn('Add-on KOT print job failed:', e)
  }

  revalidatePath('/staff/pos')
  return { success: true, newTotal }
}

/**
 * CHECKOUT: Settle an existing active/held order.
 * Marks it as settled, records payment mode, revalidates paths.
 */
export async function checkoutHeldOrder(params: {
  orderId: string
  paymentMode: PaymentMode
  discountAmount?: number
  totalAmount: number
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const isZeroTotal = params.totalAmount === 0
  const effectivePaymentMode = isZeroTotal ? 'cash' : params.paymentMode

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()

  const updatePayload: Record<string, unknown> = {
    status: 'settled',
    settled_at: new Date().toISOString(),
    payment_mode: effectivePaymentMode,
    total_amount: params.totalAmount,
  }

  if (params.discountAmount !== undefined) {
    updatePayload.discount_amount = params.discountAmount
  }

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', params.orderId)
    .eq('status', 'active')

  if (error) throw new Error(error.message)

  // Record payment (skip for zero-total / complimentary)
  if (!isZeroTotal && params.totalAmount > 0) {
    await supabase.from('payments').insert({
      order_id: params.orderId,
      amount: params.totalAmount,
      payment_mode: effectivePaymentMode,
    })
  }

  revalidatePath('/staff/pos')
  revalidatePath('/staff/kitchen')
  return { success: true }
}

/**
 * CHECKOUT MULTIPLE: Settle multiple active orders (e.g. multiple rounds for a dine-in table).
 * Marks all specified orders as settled, records payments, and revalidates paths.
 */
export async function checkoutMultipleOrders(params: {
  orderIds: string[]
  paymentMode: PaymentMode
  discountAmount?: number
  totalAmount: number
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')
  if (!params.orderIds || params.orderIds.length === 0) {
    return { success: true }
  }

  const isZeroTotal = params.totalAmount === 0
  const effectivePaymentMode = isZeroTotal ? 'cash' : params.paymentMode
  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()

  // 1. Mark all orders as settled
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'settled',
      settled_at: new Date().toISOString(),
      payment_mode: effectivePaymentMode,
    })
    .in('id', params.orderIds)
    .eq('status', 'active')

  if (updateError) throw new Error(updateError.message)

  // 2. Fetch the orders to record individual payment records in payments table
  if (!isZeroTotal && params.totalAmount > 0) {
    const { data: ordersToPay, error: fetchError } = await supabase
      .from('orders')
      .select('id, total_amount')
      .in('id', params.orderIds)

    if (fetchError) throw new Error(fetchError.message)

    if (ordersToPay && ordersToPay.length > 0) {
      const paymentRows = ordersToPay
        .filter(o => (o.total_amount ?? 0) > 0)
        .map(o => ({
          order_id: o.id,
          amount: o.total_amount,
          payment_mode: effectivePaymentMode,
        }))

      if (paymentRows.length > 0) {
        const { error: payError } = await supabase.from('payments').insert(paymentRows)
        if (payError) console.warn('Payment insert warning for multiple checkout:', payError)
      }
    }
  }

  revalidatePath('/staff/pos')
  revalidatePath('/staff/kitchen')
  return { success: true }
}

export async function listOrders(branchId: string, filters?: { status?: string; limit?: number }) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  let query = supabase
    .from('orders')
    .select('*, order_items(*), profiles(name)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateFulfillmentStatus(
  orderId: string,
  status: 'pending' | 'cooking' | 'ready' | 'served'
) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ fulfillment: status })
    .eq('id', orderId)

  if (error) throw new Error(error.message)
  // Only revalidate kitchen if used from there; POS uses optimistic UI
  revalidatePath('/staff/kitchen')
}

export async function voidOrder(orderId: string, reason: string) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason,
    })
    .eq('id', orderId)
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  revalidatePath('/staff/pos')
}

/**
 * VOID MULTIPLE / TABLE ORDERS: Void all active orders associated with a table.
 */
export async function voidTableOrders(params: {
  orderIds: string[]
  reason?: string
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  if (!params.orderIds || params.orderIds.length === 0) return { success: true }

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: params.reason || 'Cancelled by staff',
    })
    .in('id', params.orderIds)
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  revalidatePath('/staff/pos')
  return { success: true }
}

/**
 * TRANSFER TABLE: Move all active orders from one table to another (e.g. T1 to T2).
 */
export async function transferTableOrder(params: {
  orderIds: string[]
  fromTable: string
  toTable: string
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  if (!params.orderIds || params.orderIds.length === 0) return { success: true }

  const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()

  // Fetch current orders to preserve and rewrite notes
  const { data: existingOrders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, notes')
    .in('id', params.orderIds)

  if (fetchErr) throw new Error(fetchErr.message)

  for (const ord of existingOrders || []) {
    const fromClean = params.fromTable.trim()
    const toClean = params.toTable.trim()
    let updatedNotes = ord.notes || ''
    if (updatedNotes.includes(fromClean)) {
      updatedNotes = updatedNotes.split(fromClean).join(toClean)
    } else {
      updatedNotes = updatedNotes ? `${updatedNotes} [Transferred to ${toClean}]` : `[${toClean}]`
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        table_number: toClean,
        notes: updatedNotes,
      })
      .eq('id', ord.id)

    if (updateErr) throw new Error(updateErr.message)
  }

  revalidatePath('/staff/pos')
  return { success: true }
}

/**
 * REPLACE TABLE ORDER: Wipe/void previous orders for this table and insert fresh replacement order.
 */
export async function replaceTableOrder(params: {
  branchId: string
  restaurantId: string
  tableLabel: string
  oldOrderIds: string[]
  items: CartItem[]
  restaurantName?: string
  branchName?: string
  cashierName?: string
  notes?: string
}) {
  const ctx = await getActionContext()
  if (!ctx) throw new Error('Unauthorized')

  // 1. Void existing active orders for this table
  if (params.oldOrderIds && params.oldOrderIds.length > 0) {
    await voidTableOrders({
      orderIds: params.oldOrderIds,
      reason: `Replaced with new order on ${params.tableLabel}`,
    })
  }

  // 2. Create the new order for this table
  return holdOrder({
    branchId: params.branchId,
    restaurantId: params.restaurantId,
    tableLabel: params.tableLabel,
    notes: params.notes ? `[REPLACED] ${params.notes}` : '[REPLACED]',
    items: params.items,
    restaurantName: params.restaurantName,
    branchName: params.branchName,
    cashierName: params.cashierName,
  })
}
