/**
 * Format a Kitchen Order Ticket (KOT) for thermal printing.
 */
export function formatKOT(payload: any): string {
  const lines: string[] = []
  const WIDTH = 42

  const divider = '═'.repeat(WIDTH)
  const center = (text: string) => text.padStart(Math.floor((WIDTH + text.length) / 2)).padEnd(WIDTH)

  lines.push(divider)
  lines.push(center('KITCHEN ORDER TICKET'))
  lines.push(divider)
  lines.push(`ORDER #${payload.order_no}`)
  if (payload.table_number) lines.push(`Table: ${payload.table_number}`)
  lines.push(`Time: ${new Date(payload.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`)
  lines.push(divider)

  for (const item of payload.items ?? []) {
    lines.push(`${item.qty} x ${item.name}`)
    if (item.notes) lines.push(`   📌 ${item.notes}`)
  }

  if (payload.order_notes) {
    lines.push(divider)
    lines.push('NOTE: ' + payload.order_notes)
  }

  lines.push(divider)
  lines.push('')
  lines.push('')

  return lines.join('\n')
}
