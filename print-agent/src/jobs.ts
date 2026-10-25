import net from 'net'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { formatReceipt } from './templates/receipt'
import { formatKOT } from './templates/kot'

/**
 * Send raw ESC/POS text to a network/LAN thermal printer on port 9100.
 */
function sendToLanPrinter(ip: string, port: number, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    client.setTimeout(6000)

    client.connect(port, ip, () => {
      // ESC/POS commands:
      // \x1b@ = Initialize printer
      // \x1d\x56\x01 = Partial cut
      const escposData = Buffer.concat([
        Buffer.from('\x1b@', 'ascii'),
        Buffer.from(data, 'ascii'),
        Buffer.from('\n\n\n\n\x1d\x56\x01', 'ascii'),
      ])

      client.write(escposData, () => {
        client.end()
        resolve()
      })
    })

    client.on('error', (err) => {
      client.destroy()
      reject(err)
    })

    client.on('timeout', () => {
      client.destroy()
      reject(new Error(`Connection to LAN printer at ${ip}:${port} timed out`))
    })
  })
}

/**
 * Process a single print job.
 * Dispatches to LAN printer if PRINTER_IP is set, otherwise prints via Windows printer queue.
 */
export async function processPrintJob(job: any) {
  const PRINTER_IP = process.env.PRINTER_IP || process.env.KITCHEN_PRINTER_IP
  const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100)

  const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER_NAME ?? 'POS-80'
  const KITCHEN_PRINTER = process.env.KITCHEN_PRINTER_NAME ?? RECEIPT_PRINTER

  let text: string
  let printerName: string

  if (job.printer_type === 'receipt') {
    text = formatReceipt(job.payload)
    printerName = RECEIPT_PRINTER
  } else if (job.printer_type === 'kitchen') {
    text = formatKOT(job.payload)
    printerName = KITCHEN_PRINTER
  } else {
    throw new Error(`Unknown printer_type: ${job.printer_type}`)
  }

  // 1. If PRINTER_IP is defined, send directly over the local network (LAN / Wi-Fi)
  if (PRINTER_IP) {
    console.log(`📡 Sending to LAN printer at ${PRINTER_IP}:${PRINTER_PORT}...`)
    await sendToLanPrinter(PRINTER_IP, PRINTER_PORT, text)
    return
  }

  // 2. Otherwise fall back to Windows Print Queue
  const tmpFile = `C:\\Windows\\Temp\\pos_print_${job.id}.txt`
  writeFileSync(tmpFile, text, 'ascii')

  try {
    execSync(`print /D:"${printerName}" "${tmpFile}"`)
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}
