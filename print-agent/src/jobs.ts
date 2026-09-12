import { execSync } from 'child_process'
import { formatReceipt } from './templates/receipt'
import { formatKOT } from './templates/kot'

/**
 * Process a single print job.
 * Dispatches to the correct template formatter and prints via Windows CMD.
 */
export async function processPrintJob(job: any) {
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

  // Write to a temp file and print via Windows
  const tmpFile = `C:\\Windows\\Temp\\pos_print_${job.id}.txt`
  require('fs').writeFileSync(tmpFile, text, 'ascii')

  // Windows print command (works for most POS thermal printers shared via Windows)
  execSync(`print /D:"${printerName}" "${tmpFile}"`)

  // Clean up temp file
  try { require('fs').unlinkSync(tmpFile) } catch {}
}
