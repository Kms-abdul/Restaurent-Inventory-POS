'use server'

import { createClient, createServiceClient, getActionContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CartItem, PaymentMode } from '@/types/database'

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

  // Only revalidate the POS page — dashboard picks it up on next natural visit
  revalidatePath('/staff/pos')
  return result
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
