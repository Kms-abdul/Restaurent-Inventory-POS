'use server'

import { createClient, createServiceClient, getActionContext } from '@/utils/supabase/server'
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

  // When deployed on Vercel (Linux cloud server), direct Windows OS printer spooler
  // cannot be accessed directly. Queue the job into Supabase print_jobs so the local
  // Print Agent running on the restaurant's Windows PC prints it directly to the thermal printer!
  if (process.platform !== 'win32') {
    try {
      const ctx = await getActionContext()
      if (ctx && data) {
        const supabase = ctx.isSuperAdmin ? await createServiceClient() : await createClient()
        await supabase.from('print_jobs').insert({
          branch_id: ctx.branchId,
          printer_type: type === 'RECEIPT' ? 'receipt' : 'kitchen',
          payload: {
            restaurant_name: data.restaurantName,
            branch_name: data.branchName,
            order_no: data.orderNumber,
            cashier_name: data.cashierName,
            created_at: data.createdAt,
            subtotal: data.subtotal,
            discount_amount: data.discount ? Math.round(data.discount * 100) : 0,
            total_amount: data.total ? Math.round(data.total * 100) : 0,
            payment_mode: data.paymentMode,
            split_details: data.splitDetails,
            items: data.items.map(i => ({
              name: i.name,
              qty: i.quantity,
              line_total: i.lineTotal ? Math.round(i.lineTotal * 100) : (i.price ? Math.round(i.price * i.quantity * 100) : 0),
            })),
          },
          status: 'pending',
          copies: 1,
        })
        return { success: true, message: `Direct print queued for ${printerName}` }
      }
    } catch (queueErr: any) {
      console.warn('Failed to queue print job to Supabase:', queueErr)
    }
    return { success: true, message: 'Print job queued' }
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

    const sendRes = await sendEscPosToPrinter(printer, printerName)
    if (!sendRes.success) {
      return {
        success: false,
        isCloud: sendRes.isCloud ?? false,
        error: sendRes.error || 'Print failed',
      }
    }
    return { success: true, message: `Sent ${type} to ${printerName}` }
  } catch (err: any) {
    console.error('Print job failed:', err)
    return { success: false, error: err.message || 'Print error' }
  }
}

export async function getDiscoveredPrintersAction() {
  if (process.platform !== 'win32') {
    return { success: true, printers: ['POSIO QX300', 'Local Browser Print'] }
  }
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

