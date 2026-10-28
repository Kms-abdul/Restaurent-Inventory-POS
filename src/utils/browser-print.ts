import type { ThermalOrderData } from './thermal-printer'

export interface BrowserPrintOptions {
  paperWidth?: number // characters per line: 48 = 80mm, 32 = 58mm
  showPrices?: boolean
  footerText?: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const money = (n?: number) => (n ?? 0).toFixed(2)

function buildHtml(type: 'KOT' | 'RECEIPT', data: ThermalOrderData, opts: BrowserPrintOptions) {
  const widthMm = (opts.paperWidth ?? 48) <= 32 ? 58 : 80
  const time = new Date(data.createdAt ?? Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const header = `
    <div class="c b big">${esc(data.restaurantName || 'RESTAURANT')}</div>
    ${data.branchName ? `<div class="c">${esc(data.branchName)}</div>` : ''}
    <hr>`

  let body: string
  if (type === 'KOT') {
    body = `
      <div class="c b">KITCHEN ORDER TICKET</div>
      <div class="c b xl">ORDER #${esc(data.orderNumber)}</div>
      <hr>
      <div>${esc(time)}${data.cashierName ? ` &middot; ${esc(data.cashierName)}` : ''}</div>
      <hr>
      ${data.items.map(i => `<div class="row b"><span>${esc(i.name)}</span><span>x ${esc(i.quantity)}</span></div>`).join('')}
      <hr>`
  } else {
    const showPrices = opts.showPrices !== false
    body = `
      <div class="row"><span>Bill #${esc(data.orderNumber)}</span><span>${esc(time)}</span></div>
      ${data.cashierName ? `<div>Cashier: ${esc(data.cashierName)}</div>` : ''}
      <hr>
      ${data.items.map(i => {
        const line = i.lineTotal ?? (i.price ?? 0) * i.quantity
        return `<div class="row"><span>${esc(i.name)} x ${esc(i.quantity)}</span>${showPrices ? `<span>${money(line)}</span>` : ''}</div>`
      }).join('')}
      <hr>
      ${data.subtotal != null ? `<div class="row"><span>Subtotal</span><span>${money(data.subtotal)}</span></div>` : ''}
      ${data.discount ? `<div class="row"><span>Discount</span><span>-${money(data.discount)}</span></div>` : ''}
      <div class="row b big"><span>TOTAL</span><span>&#8377;${money(data.total)}</span></div>
      ${data.paymentMode ? `<div>Paid by: ${esc(data.paymentMode)}</div>` : ''}
      <hr>
      <div class="c">${esc(opts.footerText || '** THANK YOU VISIT AGAIN **')}</div>`
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${widthMm}mm; padding: 2mm 3mm 6mm; font: 12px/1.35 'Courier New', monospace; color: #000; }
    .c { text-align: center; } .b { font-weight: bold; }
    .big { font-size: 15px; } .xl { font-size: 20px; margin: 2px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  </style></head><body>${header}${body}</body></html>`
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
