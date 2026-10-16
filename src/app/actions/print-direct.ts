'use server'

import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface PrintTicketPayload {
  orderNo: number
  time: string
  cashier: string
  notes?: string
  items: { name: string; qty: number }[]
  printerName?: string
}

export async function printDirectToThermalPrinter(ticket: PrintTicketPayload) {
  const WIDTH = 32
  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2))
    return ' '.repeat(pad) + text
  }
  const eq = '='.repeat(WIDTH)
  const dash = '-'.repeat(WIDTH)

  const lines: string[] = []
  lines.push('')
  lines.push(center('** KITCHEN ORDER TICKET **'))
  lines.push(eq)
  lines.push(center(`ORDER #${ticket.orderNo}`))
  lines.push(eq)
  lines.push(`Time: ${ticket.time}`)
  lines.push(`By: ${ticket.cashier}`)
  lines.push(dash)
  lines.push('ITEMS:')
  for (const item of ticket.items) {
    const name = `  ${item.name || 'Item'}`
    const qty = `x${item.qty}`
    const pad = WIDTH - name.length - qty.length
    lines.push(name + (pad > 0 ? ' '.repeat(pad) : ' ') + qty)
  }
  if (ticket.notes) {
    lines.push(dash)
    lines.push(`Note: ${ticket.notes}`)
  }
  lines.push(eq)
  lines.push(center('** PLEASE PREPARE **'))
  lines.push(eq)
  lines.push('')
  lines.push('')
  lines.push('')
  lines.push('')

  const content = lines.join('\r\n')
  const tmpFile = join(tmpdir(), `kot_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`)
  const targetPrinter = ticket.printerName || 'POSIO QX300'

  try {
    writeFileSync(tmpFile, content, 'utf8')
    const psScript = `Get-Content -LiteralPath '${tmpFile.replace(/'/g, "''")}' | Out-Printer -Name '${targetPrinter.replace(/'/g, "''")}'`
    const b64 = Buffer.from(psScript, 'utf16le').toString('base64')
    await execFileAsync('powershell.exe', ['-NoProfile', '-EncodedCommand', b64])
    return { success: true }
  } catch (err: any) {
    console.error('Direct print failed:', err)
    return { success: false, error: err.message || 'Direct print error' }
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {}
  }
}
