/**
 * Format a Kitchen Order Ticket (KOT) for thermal printing.
 * Width: 42 chars for 80mm paper (QX300 / POS-80 standard)
 */
export function formatKOT(payload: any): string {
  const lines: string[] = []
  const WIDTH = 42

  const stars  = (s: string) => `** ${s} **`
  const eq     = '='.repeat(WIDTH)
  const dash   = '-'.repeat(WIDTH)
  const center = (text: string) =>
    text.padStart(Math.floor((WIDTH + text.length) / 2)).padEnd(WIDTH)

  // ── Header ──────────────────────────────────────────────────────
  lines.push('')
  if (payload.restaurant_name) {
    lines.push(center(payload.restaurant_name.toUpperCase()))
  }
  if (payload.branch_name) {
    lines.push(center(payload.branch_name))
  }
  lines.push(eq)
  lines.push(center(stars('KITCHEN ORDER TICKET')))
  lines.push(eq)

  // ── Order info ──────────────────────────────────────────────────
  lines.push(`ORDER # ${payload.order_no}`)
  if (payload.table_number) lines.push(`Table : ${payload.table_number}`)
  const time = payload.created_at
    ? new Date(payload.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  lines.push(`Time  : ${time}`)
  if (payload.cashier_name) lines.push(`By    : ${payload.cashier_name}`)
  lines.push(dash)

  // ── Items ───────────────────────────────────────────────────────
  lines.push('ITEMS:')
  for (const item of payload.items ?? []) {
    const name = String(item.name || 'Item')
    const qty  = `x${item.qty}`
    // Pad name left, qty right — total WIDTH chars
    const pad = WIDTH - name.length - qty.length
    lines.push(name + (pad > 0 ? ' '.repeat(pad) : ' ') + qty)
    if (item.notes) lines.push(`   >> ${item.notes}`)
  }

  // ── Notes ───────────────────────────────────────────────────────
  if (payload.order_notes) {
    lines.push(dash)
    lines.push('NOTE: ' + payload.order_notes)
  }

  // ── Footer ──────────────────────────────────────────────────────
  lines.push(eq)
  lines.push(center(stars('PLEASE PREPARE')))
  lines.push(eq)
  lines.push('')
  lines.push('')

  return lines.join('\n')
}
