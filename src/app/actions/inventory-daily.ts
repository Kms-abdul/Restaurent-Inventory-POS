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

export interface DailyLedgerItem {
  inventory_item_id: string
  name: string
  unit: string
  low_stock_threshold: number
  opening_stock: number
  stock_in: number
  stock_consumed: number
  wastage: number
  expected_closing: number
  actual_qty: number
  variance_qty: number
  is_audited: boolean
  adjustment_reason?: string
  notes?: string
}

export interface DailyLedgerSummary {
  date: string
  branch_id: string
  items: DailyLedgerItem[]
  total_items: number
  total_stock_in: number
  total_consumed: number
  total_wastage: number
  discrepancies_count: number
  has_eod_audit: boolean
  audit_id?: string
  audit_notes?: string
}

/**
 * Fetch the Day-wise Inventory Ledger for a specific branch and business date.
 * - Opening stock = cumulative SUM(quantity) of all transactions BEFORE this date.
 *   (Yesterday's EOD closing stock is automatically today's opening stock).
 * - Stock In = purchases/transfers added on this date.
 * - Stock Consumed = sale_consumption auto-deducted by POS orders on this date.
 * - Wastage = deliberate waste/spoilage logged on this date.
 * - Expected Closing = Opening + In - Consumed - Wastage.
 * - Actual / Audited = physical count recorded for this date (if audited).
 */
export async function getDailyInventoryLedger(
  branchId: string,
  dateStr: string // 'YYYY-MM-DD'
): Promise<DailyLedgerSummary> {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()

  // Define date boundaries for the selected day in UTC/ISO
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`

  // 1. Fetch active inventory items for this restaurant
  const { data: rawItems, error: itemsError } = await admin
    .from('inventory_items')
    .select('id, name, unit, low_stock_threshold')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (itemsError) throw new Error(itemsError.message)
  const items = rawItems ?? []

  // 2. Fetch all inventory transactions for this branch up to the end of the selected day
  const { data: rawTx, error: txError } = await admin
    .from('inventory_transactions')
    .select('inventory_item_id, transaction_type, quantity, created_at')
    .eq('branch_id', branchId)
    .lte('created_at', endOfDay)

  if (txError) throw new Error(txError.message)
  const transactions = rawTx ?? []

  // 3. Fetch any existing confirmed/draft EOD stock count for this branch and date
  const { data: rawCounts } = await admin
    .from('stock_counts')
    .select(`
      id, counted_at, notes, status,
      stock_count_items (
        id, inventory_item_id, expected_qty, actual_qty, variance_qty, adjustment_reason, notes
      )
    `)
    .eq('branch_id', branchId)
    .gte('counted_at', startOfDay)
    .lte('counted_at', endOfDay)
    .order('counted_at', { ascending: false })
    .limit(1)

  const existingAudit = rawCounts && rawCounts.length > 0 ? rawCounts[0] : null
  const auditItemMap = new Map<string, any>()
  if (existingAudit?.stock_count_items) {
    for (const sci of existingAudit.stock_count_items as any[]) {
      auditItemMap.set(sci.inventory_item_id, sci)
    }
  }

  // 4. Compute ledger metrics per item
  let totalStockIn = 0
  let totalConsumed = 0
  let totalWastage = 0
  let discrepanciesCount = 0

  const ledgerItems: DailyLedgerItem[] = items.map(item => {
    let opening = 0
    let stockIn = 0
    let consumed = 0
    let waste = 0
    let adjustment = 0

    for (const tx of transactions) {
      if (tx.inventory_item_id !== item.id) continue

      const txDate = tx.created_at
      const qty = Number(tx.quantity) || 0

      if (txDate < startOfDay) {
        // Prior to today: rolls into Opening Stock
        opening += qty
      } else {
        // On this day
        if (tx.transaction_type === 'opening') {
          // Explicit initial opening balance established on this day
          opening += qty
        } else if (
          (tx.transaction_type === 'purchase' ||
            tx.transaction_type === 'transfer_in') &&
          qty > 0
        ) {
          stockIn += qty
        } else if (tx.transaction_type === 'sale_consumption') {
          consumed += Math.abs(qty)
        } else if (tx.transaction_type === 'wastage' || tx.transaction_type === 'spoilage') {
          waste += Math.abs(qty)
        } else if (tx.transaction_type === 'adjustment') {
          adjustment += qty
        } else if (qty > 0) {
          stockIn += qty
        } else {
          waste += Math.abs(qty)
        }
      }
    }

    const expectedClosing = opening + stockIn - consumed - waste + adjustment

    // Check if an audit record was already stored for today
    const auditRecord = auditItemMap.get(item.id)
    const isAudited = Boolean(auditRecord)
    const actualQty = isAudited ? Number(auditRecord.actual_qty) : expectedClosing
    const varianceQty = actualQty - expectedClosing

    if (Math.abs(varianceQty) > 0.001) {
      discrepanciesCount++
    }

    totalStockIn += stockIn
    totalConsumed += consumed
    totalWastage += waste

    return {
      inventory_item_id: item.id,
      name: item.name,
      unit: item.unit,
      low_stock_threshold: Number(item.low_stock_threshold || 0),
      opening_stock: Number(opening.toFixed(3)),
      stock_in: Number(stockIn.toFixed(3)),
      stock_consumed: Number(consumed.toFixed(3)),
      wastage: Number(waste.toFixed(3)),
      expected_closing: Number(expectedClosing.toFixed(3)),
      actual_qty: Number(actualQty.toFixed(3)),
      variance_qty: Number(varianceQty.toFixed(3)),
      is_audited: isAudited,
      adjustment_reason: auditRecord?.adjustment_reason,
      notes: auditRecord?.notes,
    }
  })

  return {
    date: dateStr,
    branch_id: branchId,
    items: ledgerItems,
    total_items: items.length,
    total_stock_in: Number(totalStockIn.toFixed(2)),
    total_consumed: Number(totalConsumed.toFixed(2)),
    total_wastage: Number(totalWastage.toFixed(2)),
    discrepancies_count: discrepanciesCount,
    has_eod_audit: Boolean(existingAudit),
    audit_id: existingAudit?.id,
    audit_notes: existingAudit?.notes ?? undefined,
  }
}

/**
 * Submit and confirm the Day-wise EOD Stock Audit for a specific date.
 * - Logs the physical count in stock_counts & stock_count_items.
 * - If actual physical count differs from expected, inserts an adjustment transaction
 *   on that business date so closing stock precisely matches physical count.
 *   This ensures tomorrow's opening stock begins with the physical count.
 */
export async function submitDailyEODAuditAction(data: {
  branch_id: string
  date: string // 'YYYY-MM-DD'
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
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()

  // Timestamp for this audit (end of the business day)
  const isToday = new Date().toISOString().slice(0, 10) === data.date
  const auditTimestamp = isToday ? new Date().toISOString() : `${data.date}T23:59:00.000Z`

  // 1. Create the stock count record
  const { data: countRow, error: countError } = await admin
    .from('stock_counts')
    .insert({
      branch_id: data.branch_id,
      counted_by: ctx.userId,
      status: 'confirmed',
      notes: data.notes || `Daily EOD Audit for ${data.date}`,
      counted_at: auditTimestamp,
      confirmed_at: auditTimestamp,
    })
    .select('id')
    .single()

  if (countError) throw new Error(countError.message)
  const stockCountId = countRow.id

  // 2. Insert items and ledger adjustment transactions
  if (data.items.length > 0) {
    const itemRows = data.items.map(i => ({
      stock_count_id: stockCountId,
      inventory_item_id: i.inventory_item_id,
      expected_qty: i.expected_qty,
      actual_qty: i.actual_qty,
      variance_qty: i.variance_qty,
      adjustment_reason: i.adjustment_reason || (i.variance_qty !== 0 ? 'wastage' : 'none'),
      notes: i.notes || null,
    }))

    const { error: itemsError } = await admin.from('stock_count_items').insert(itemRows)
    if (itemsError) throw new Error(itemsError.message)

    // Insert adjustment transactions for any variance so ledger is balanced
    for (const item of data.items) {
      if (Math.abs(item.variance_qty) > 0.001) {
        const txType =
          item.adjustment_reason === 'spoilage'
            ? 'spoilage'
            : item.adjustment_reason === 'wastage'
            ? 'wastage'
            : 'adjustment'

        await admin.from('inventory_transactions').insert({
          inventory_item_id: item.inventory_item_id,
          branch_id: data.branch_id,
          transaction_type: txType,
          quantity: item.variance_qty, // positive if surplus, negative if shortfall
          unit: 'unit',
          reference_id: stockCountId,
          notes: `EOD Count (${data.date}): ${item.notes || item.adjustment_reason || 'variance adjustment'}`,
          created_by: ctx.userId,
          created_at: auditTimestamp,
        })
      }
    }
  }

  revalidatePath('/restaurant/inventory')
  revalidatePath('/restaurant/inventory/audit')
  revalidatePath('/restaurant/dashboard')

  return { success: true, stock_count_id: stockCountId }
}
