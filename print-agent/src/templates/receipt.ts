/**
 * Format a customer receipt as plain text for ESC/POS thermal printer.
 * The payload is the JSON stored in print_jobs.payload.
 */
export function formatReceipt(payload: any): string {
  const lines: string[] = []
  const WIDTH = 42

  const center = (text: string) => text.padStart(Math.floor((WIDTH + text.length) / 2)).padEnd(WIDTH)
  const divider = '─'.repeat(WIDTH)
  const line = (left: string, right: string) => {
    const l = left.substring(0, WIDTH - right.length - 1)
    return l + ' '.repeat(WIDTH - l.length - right.length) + right
  }

  lines.push('')
  lines.push(center(payload.restaurant_name ?? 'RESTAURANT'))
  if (payload.branch_name) lines.push(center(payload.branch_name))
  if (payload.branch_address) lines.push(center(payload.branch_address))
  lines.push(divider)
  lines.push(line('ORDER #' + payload.order_no, payload.created_at ?? ''))
  if (payload.table_number) lines.push('Table: ' + payload.table_number)
  if (payload.cashier_name) lines.push('Cashier: ' + payload.cashier_name)
  lines.push(divider)

  for (const item of payload.items ?? []) {
    const qty = String(item.qty)
    const price = '₹' + (item.line_total / 100).toFixed(0)
    const name = item.name.substring(0, WIDTH - qty.length - price.length - 2)
    lines.push(`${qty} ${name.padEnd(WIDTH - qty.length - price.length - 2)} ${price}`)
  }

  lines.push(divider)
  if (payload.discount_amount > 0) {
    lines.push(line('Discount', '-₹' + (payload.discount_amount / 100).toFixed(0)))
  }
  lines.push(line('TOTAL', '₹' + (payload.total_amount / 100).toFixed(0)))
  lines.push(line('Payment', (payload.payment_mode ?? '').toUpperCase()))
  lines.push(divider)
  lines.push(center('Thank you for dining with us!'))
  lines.push('')
  lines.push('')
  lines.push('')

  return lines.join('\n')
}
