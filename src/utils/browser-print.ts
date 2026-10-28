import type { ThermalOrderData } from './thermal-printer'

export interface BrowserPrintOptions {
  paperWidth?: number // characters per line: 48 = 80mm, 32 = 58mm
  showPrices?: boolean
  footerText?: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const money = (n?: number) => (n ?? 0).toFixed(2)

// Mirrors the ESC/POS layout used by the desktop POS (pos-app print.routes.js):
// fixed-width firmware font, `width` chars per line, double-height item rows.
export function buildHtml(type: 'KOT' | 'RECEIPT', data: ThermalOrderData, opts: BrowserPrintOptions) {
  const width = opts.paperWidth ?? 48
  const widthMm = width <= 32 ? 58 : 80
  const printableMm = width <= 32 ? 48 : 72
  const line = (ch = '-') => `<div>${ch.repeat(width)}</div>`
  const leftRight = (l: string, r: string, cls = '') =>
    `<div class="lr ${cls}"><span>${esc(l)}</span><span>${esc(r)}</span></div>`

  // Callers append the table to branchName as "<branch> | T1 — Round 2"
  const table = data.branchName?.split(' | ').slice(1).join(' | ').trim()

  let body: string
  if (type === 'KOT') {
    body = `
      <div class="c">
        <br>
        <div class="b">KITCHEN ORDER TICKET</div>
        ${line('-')}
        <div class="b quad">ORDER #${esc(data.orderNumber)}</div>
        ${table ? `<div class="b quad">${esc(/^t\d/i.test(table) ? `TABLE ${table}` : table)}</div>` : ''}
        ${line('=')}
        <div class="b">ITEMS:</div>
        ${data.items.map(i => `<div class="b item">&bull; ${esc(i.name)} x ${esc(i.quantity)}</div>`).join('')}
        ${line('=')}
      </div>`
  } else {
    const name = (data.restaurantName || 'CHINESE NAWAB').toUpperCase()
    const created = new Date(data.createdAt ?? Date.now())
    const dateStr = created.toLocaleDateString('en-IN')
    const timeStr = created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    const itemColChars = Math.floor(width * 0.62)
    const row = (item: string, qty: string, total: string, cls = '') =>
      `<div class="tbl ${cls}"><span>${esc(item)}</span><span class="c">${esc(qty)}</span><span class="r">${esc(total)}</span></div>`

    body = `
      <div class="c"><br><div class="b">${esc(name)}</div></div>
      ${line()}
      ${leftRight(`Order: #${data.orderNumber}`, `${dateStr} ${timeStr}`)}
      ${table ? `<div class="b">Table: ${esc(table)}</div>` : ''}
      ${line()}
      ${row('Item', 'Qty', 'Total')}
      ${data.items.map(i => {
        const lineTotal = i.lineTotal != null ? i.lineTotal : (i.price != null ? i.price * i.quantity : 0)
        return row(String(i.name || '').substring(0, itemColChars - 1), String(i.quantity), money(lineTotal), 'dh')
      }).join('')}
      ${line()}
      ${leftRight('TOTAL', money(data.total), 'dh b')}
      ${data.paymentMode && data.paymentMode !== 'Pending' ? `<div>Payment: ${esc(data.paymentMode)}</div>` : ''}
      <br>
      <div class="c">Thank You! Visit Again. ${esc(data.restaurantName || 'Chinese Nawab')}</div>`
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${widthMm}mm; padding: 0 ${(widthMm - printableMm) / 2}mm 8mm; color: #000;
      font-family: 'Courier New', Courier, monospace; font-size: ${(printableMm / width / 0.6).toFixed(3)}mm; line-height: 1.05;
      overflow: hidden; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
    .lr { display: flex; justify-content: space-between; }
    .tbl { display: grid; grid-template-columns: 62% 13% 25%; }
    .tbl span { overflow: hidden; }
    .dh { transform: scaleY(2); transform-origin: top; margin-bottom: 1.05em; }
    .quad { font-size: 2em; line-height: 1.05; }
    .item { font-size: 1.5em; line-height: 1.1; }
  </style></head><body>${body}</body></html>`
}

/**
 * Prints a KOT/receipt through the browser's print system using a hidden iframe.
 * Silent (no dialog) when Chrome is launched with --kiosk-printing.
 */
export function printViaBrowser(type: 'KOT' | 'RECEIPT', data: ThermalOrderData, opts: BrowserPrintOptions = {}): Promise<void> {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 1000)
      resolve()
    }

    const doc = iframe.contentDocument!
    doc.open()
    doc.write(buildHtml(type, data, opts))
    doc.close()

    // Give the iframe a tick to lay out before printing
    setTimeout(() => {
      try {
        const win = iframe.contentWindow!
        win.focus()
        win.print()
      } finally {
        cleanup()
      }
    }, 100)
  })
}
