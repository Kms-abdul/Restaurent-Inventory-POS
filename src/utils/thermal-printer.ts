import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'

const execFileAsync = promisify(execFile)

export interface ThermalItem {
  name: string
  quantity: number
  price?: number
  lineTotal?: number
}

export interface ThermalOrderData {
  orderNumber: number | string
  createdAt?: string | Date
  restaurantName?: string
  branchName?: string
  cashierName?: string
  items: ThermalItem[]
  subtotal?: number
  discount?: number
  total: number
  paymentMode?: string
}

export function getThermalPrinter(width: number = 48): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'dummy.bin',
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    width: width || 48,
    options: { timeout: 5000 },
  })
}

function money(n: any): string {
  return Number(n || 0).toFixed(2)
}

export function buildReceipt(printer: ThermalPrinter, data: ThermalOrderData) {
  printer.alignCenter()
  printer.newLine()
  printer.bold(true)

  const title = data.restaurantName || 'CHINESE NAWAB'
  printer.println(title.toUpperCase())
  printer.bold(false)

  if (data.branchName) {
    printer.println(data.branchName)
  }

  printer.drawLine()

  const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')
  const timeStr = data.createdAt ? new Date(data.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  printer.leftRight(`Order: #${data.orderNumber}`, `${dateStr} ${timeStr}`)
  if (data.cashierName) {
    printer.leftRight(`By: ${data.cashierName}`, '')
  }

  printer.drawLine()

  printer.tableCustom([
    { text: 'Item', align: 'LEFT', width: 0.62 },
    { text: 'Qty', align: 'CENTER', width: 0.13 },
    { text: 'Total', align: 'RIGHT', width: 0.25 },
  ])

  const paperWidth = printer.getWidth() || 48
  const itemColChars = Math.floor(paperWidth * 0.62)

  printer.setTextDoubleHeight()
  for (const item of data.items || []) {
    const lineTotal = item.lineTotal != null
      ? item.lineTotal
      : (item.price != null ? item.price * item.quantity : 0)

    const safeName = String(item.name || '').substring(0, itemColChars - 1)

    printer.tableCustom([
      { text: safeName, align: 'LEFT', width: 0.62 },
      { text: String(item.quantity), align: 'CENTER', width: 0.13 },
      { text: money(lineTotal), align: 'RIGHT', width: 0.25 },
    ])
  }
  printer.setTextNormal()

  printer.drawLine()

  if (data.subtotal && data.discount && data.discount > 0) {
    printer.leftRight('Subtotal', money(data.subtotal))
    printer.leftRight('Discount', `-${money(data.discount)}`)
    printer.drawLine('-')
  }

  printer.setTextDoubleHeight()
  printer.bold(true)
  printer.leftRight('TOTAL', `Rs.${money(data.total)}`)
  printer.bold(false)
  printer.setTextNormal()

  if (data.paymentMode && data.paymentMode !== 'Pending') {
    printer.println(`Payment: ${data.paymentMode.toUpperCase()}`)
  }
  printer.newLine()
  printer.alignCenter()
  printer.println(`Thank You! Visit Again. ${title}`)
  printer.newLine()
  printer.newLine()
  printer.cut()
}

export function buildKOT(printer: ThermalPrinter, data: ThermalOrderData) {
  printer.alignCenter()
  printer.newLine()
  printer.bold(true)
  printer.println('KITCHEN ORDER TICKET')
  printer.bold(false)
  printer.drawLine('-')

  printer.setTextQuadArea()
  printer.bold(true)
  printer.println(`ORDER #${data.orderNumber}`)
  printer.bold(false)
  printer.setTextNormal()

  printer.drawLine('=')

  const timeStr = data.createdAt ? new Date(data.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  printer.alignLeft()
  printer.println(`Time: ${timeStr}`)
  if (data.cashierName) {
    printer.println(`By: ${data.cashierName}`)
  }
  printer.drawLine('-')

  printer.bold(true)
  printer.println('ITEMS:')
  printer.bold(false)

  for (const item of data.items || []) {
    printer.println(`  \u2022 ${item.name}  x ${item.quantity}`)
  }

  printer.drawLine('=')
  printer.alignCenter()
  printer.bold(true)
  printer.println('** PLEASE PREPARE **')
  printer.bold(false)
  printer.newLine()
  printer.newLine()
  printer.cut()
}

export function buildTest(printer: ThermalPrinter, printerName: string, width: number) {
  printer.alignCenter()
  printer.bold(true)
  printer.println('** PRINT TEST **')
  printer.bold(false)
  printer.drawLine()
  printer.println('Chinese Nawab POS')
  printer.newLine()
  printer.alignLeft()
  printer.println(`Printer: ${printerName}`)
  printer.println(`Width: ${width} chars`)
  printer.println(`Time: ${new Date().toLocaleTimeString('en-IN')}`)
  printer.newLine()
  printer.drawLine()
  printer.alignCenter()
  printer.println('Printer working correctly!')
  printer.newLine()
  printer.newLine()
  printer.cut()
}

export async function sendEscPosToPrinter(printer: ThermalPrinter, printerName: string = 'POSIO QX300') {
  const buffer = printer.getBuffer()
  if (!buffer || buffer.length === 0) {
    throw new Error('No print data generated')
  }

  const tempFile = join(tmpdir(), `pos-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`)
  writeFileSync(tempFile, buffer)

  const rawScript = join(process.cwd(), 'src', 'utils', 'print-raw.ps1')

  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      rawScript,
      '-PrinterName',
      printerName,
      '-FilePath',
      tempFile,
    ])
    return { success: true }
  } finally {
    try {
      unlinkSync(tempFile)
    } catch {}
  }
}
