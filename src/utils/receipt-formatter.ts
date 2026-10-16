export interface PrintTicketItem {
  name: string
  qty: number
  unitPrice?: number
  lineTotal?: number
  notes?: string
}

export interface PrintTicketPayload {
  orderNo: number
  time: string
  date?: string
  cashier: string
  restaurantName?: string
  branchName?: string
  headerText?: string
  tagline?: string
  footerText?: string
  ticketType?: 'receipt' | 'kot'
  paperWidth?: number
  showPrices?: boolean
  subtotal?: number
  discount?: number
  discountReason?: string
  total?: number
  paymentMode?: string
  notes?: string
  items: PrintTicketItem[]
  printerName?: string
}

export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const w of words) {
    if (!current) {
      current = w
    } else if ((current + ' ' + w).length <= maxWidth) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

export function formatTicketText(ticket: PrintTicketPayload): string {
  // Default width 30 chars ensures zero text wrapping or line breaks on 58mm/80mm thermal printers
  const WIDTH = ticket.paperWidth && ticket.paperWidth >= 28 && ticket.paperWidth <= 48 ? ticket.paperWidth : 30
  const eq = '='.repeat(WIDTH)
  const dash = '-'.repeat(WIDTH)

  const center = (text: string) => {
    const trimmed = text.trim().slice(0, WIDTH)
    const pad = Math.max(0, Math.floor((WIDTH - trimmed.length) / 2))
    return ' '.repeat(pad) + trimmed
  }

  const lines: string[] = []

  // 1. Header (Logo / Restaurant / Branch)
  const mainHeader = ticket.headerText || ticket.restaurantName
  if (mainHeader) {
    lines.push(center(mainHeader.toUpperCase()))
  }
  const subHeader = ticket.tagline || ticket.branchName
  if (subHeader) {
    lines.push(center(subHeader))
  }

  lines.push(eq)
  const title = ticket.ticketType === 'receipt'
    ? 'RECEIPT / TAX INVOICE'
    : '** KITCHEN ORDER TICKET **'
  lines.push(center(title))
  lines.push(eq)

  // 2. Order Metadata
  const leftOrder = `ORDER #${ticket.orderNo}`
  const rightTime = `TIME: ${ticket.time}`
  const midSpaces = Math.max(1, WIDTH - leftOrder.length - rightTime.length)
  lines.push(leftOrder + ' '.repeat(midSpaces) + rightTime)

  if (ticket.cashier) {
    lines.push(`By: ${ticket.cashier}`)
  }
  lines.push(dash)

  // 3. Items Table
  const isReceipt = ticket.ticketType === 'receipt' || ticket.showPrices
  if (isReceipt) {
    // 3-Column format: ITEM (Left), QTY (Center/Right), AMOUNT (Right)
    const priceW = 7  // e.g. " 120.00"
    const qtyW = 3    // e.g. " 1x"
    const itemW = Math.max(10, WIDTH - priceW - qtyW) // 20 chars at width 30

    lines.push('ITEM'.padEnd(itemW) + 'QTY'.padStart(qtyW) + 'AMOUNT'.padStart(priceW))
    lines.push(dash)

    for (const item of ticket.items) {
      const lineAmt = item.lineTotal !== undefined
        ? item.lineTotal
        : (item.unitPrice ? item.unitPrice * item.qty : 0)
      const priceStr = lineAmt.toFixed(2).slice(0, priceW).padStart(priceW)
      const qtyStr = `${item.qty}x`.slice(0, qtyW).padStart(qtyW)

      const itemLines = wrapText(item.name || 'Item', itemW - 1)

      // First line: Item Name (left), Qty, Amount
      lines.push(itemLines[0].padEnd(itemW) + qtyStr + priceStr)

      // Sub-lines for long item names wrapped underneath
      for (let i = 1; i < itemLines.length; i++) {
        lines.push(('  ' + itemLines[i]).padEnd(itemW))
      }
      if (item.notes) {
        lines.push(`  >> ${item.notes}`.slice(0, WIDTH))
      }
    }

    lines.push(dash)

    // Subtotal
    if (ticket.subtotal !== undefined) {
      const subVal = ticket.subtotal.toFixed(2)
      lines.push('Subtotal:'.padEnd(WIDTH - subVal.length) + subVal)
    }
    // Discount
    if (ticket.discount !== undefined && ticket.discount > 0) {
      const discVal = `-${ticket.discount.toFixed(2)}`
      lines.push('Discount:'.padEnd(WIDTH - discVal.length) + discVal)
    }

    lines.push(eq)
    const finalTotal = ticket.total !== undefined ? ticket.total : (ticket.subtotal || 0)
    const totalVal = finalTotal.toFixed(2)
    lines.push('TOTAL (RS):'.padEnd(WIDTH - totalVal.length) + totalVal)
    lines.push(eq)

    if (ticket.paymentMode) {
      lines.push(`Payment: ${ticket.paymentMode.toUpperCase()}`)
    }
  } else {
    // KOT 2-Column format: ITEM (Left) and QTY (Right)
    lines.push('ITEMS:')
    const qtyW = 4
    const itemW = WIDTH - qtyW

    for (const item of ticket.items) {
      const qtyStr = `${item.qty}x`.padStart(qtyW)
      const itemLines = wrapText(item.name || 'Item', itemW - 1)

      lines.push(itemLines[0].padEnd(itemW) + qtyStr)
      for (let i = 1; i < itemLines.length; i++) {
        lines.push(('  ' + itemLines[i]).padEnd(itemW))
      }
      if (item.notes) {
        lines.push(`  >> ${item.notes}`.slice(0, WIDTH))
      }
    }
    lines.push(eq)
  }

  // 4. Notes if any
  if (ticket.notes) {
    lines.push(`Note: ${ticket.notes}`)
    lines.push(dash)
  }

  // 5. Footer
  const footer = ticket.footerText || (isReceipt ? '** THANK YOU VISIT AGAIN **' : '** PLEASE PREPARE **')
  lines.push(center(footer))
  lines.push(eq)

  // Exactly 2 blank lines for clean tear at cutter — NO extra blank paper
  lines.push('')
  lines.push('')

  return lines.join('\r\n')
}
