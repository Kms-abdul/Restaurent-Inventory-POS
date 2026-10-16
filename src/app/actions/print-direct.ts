'use server'

import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  getThermalPrinter,
  buildReceipt,
  buildKOT,
  buildTest,
  sendEscPosToPrinter,
  type ThermalOrderData,
} from '@/utils/thermal-printer'

const execFileAsync = promisify(execFile)

export interface PrintJobParams {
  type: 'RECEIPT' | 'KOT' | 'TEST'
  data?: ThermalOrderData
  printerName?: string
  paperWidth?: number
  enableKotPrint?: boolean
  enableReceiptPrint?: boolean
}

export async function printJobAction(params: PrintJobParams) {
  const {
    type,
    data,
    printerName = 'POSIO QX300',
    paperWidth = 48,
    enableKotPrint = true,
    enableReceiptPrint = true,
  } = params

  if (type === 'RECEIPT' && enableReceiptPrint === false) {
    return { success: true, message: 'Receipt print disabled in settings' }
  }
  if (type === 'KOT' && enableKotPrint === false) {
    return { success: true, message: 'KOT print disabled in settings' }
  }

  const printer = getThermalPrinter(paperWidth)

  try {
    if (type === 'RECEIPT') {
      if (!data) throw new Error('No order data provided for RECEIPT')
      buildReceipt(printer, data)
    } else if (type === 'KOT') {
      if (!data) throw new Error('No order data provided for KOT')
      buildKOT(printer, data)
    } else if (type === 'TEST') {
      buildTest(printer, printerName, paperWidth)
    } else {
      throw new Error(`Unknown print type: ${type}`)
    }

    await sendEscPosToPrinter(printer, printerName)
    return { success: true, message: `Sent ${type} to ${printerName}` }
  } catch (err: any) {
    console.error('Print job failed:', err)
    return { success: false, error: err.message || 'Print error' }
  }
}

export async function getDiscoveredPrintersAction() {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-Printer | Select-Object Name | ConvertTo-Json',
    ])

    const parsed = JSON.parse(stdout || '[]')
    const list = (Array.isArray(parsed) ? parsed : [parsed])
      .map((p: any) => p?.Name)
      .filter(Boolean) as string[]

    if (!list.includes('POSIO QX300')) {
      list.unshift('POSIO QX300')
    }
    return { success: true, printers: list }
  } catch (err) {
    console.warn('Could not auto-detect printers, returning default:', err)
    return { success: true, printers: ['POSIO QX300'] }
  }
}

export async function printDirectToThermalPrinter(payload: any) {
  const isKot = payload.ticketType === 'kot'
  return printJobAction({
    type: isKot ? 'KOT' : 'RECEIPT',
    printerName: payload.printerName || 'POSIO QX300',
    paperWidth: payload.paperWidth || 48,
    data: {
      orderNumber: payload.orderNo,
      createdAt: payload.createdAt || new Date().toISOString(),
      restaurantName: payload.headerText || payload.restaurantName || 'CHINESE NAWAB',
      branchName: payload.tagline || payload.branchName,
      cashierName: payload.cashier,
      subtotal: payload.subtotal,
      discount: payload.discount,
      total: payload.total,
      paymentMode: payload.paymentMode,
      items: (payload.items || []).map((i: any) => ({
        name: i.name,
        quantity: i.qty || i.quantity || 1,
        price: i.unitPrice ?? i.price,
        lineTotal: i.lineTotal,
      })),
    },
  })
}

