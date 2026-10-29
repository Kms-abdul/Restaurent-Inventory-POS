'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { cancelOrderFromReport } from '@/app/actions/orders'

export interface ReportOrder {
  id: string
  order_no: number
  created_at: string
  branchName: string | null
  payment_mode: string | null
  status: string
  total_amount: number // paise
  void_reason: string | null
  items: { name: string; qty: number; line_total: number }[] // line_total in paise
}

const MAX_ROWS_ON_SCREEN = 200

const rupees = (paise: number) => (Number(paise || 0) / 100).toFixed(2)
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })

export default function OrderRecords({ orders, rangeLabel }: { orders: ReportOrder[]; rangeLabel: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleCancel = (o: ReportOrder) => {
    const reason = window.prompt(`Cancel order #${o.order_no} (₹${rupees(o.total_amount)})?\n\nEnter a reason:`, 'Customer cancelled')
    if (reason === null) return
    setCancellingId(o.id)
    startTransition(async () => {
      try {
        await cancelOrderFromReport(o.id, reason)
        router.refresh()
      } catch (err) {
        alert('Cancel failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      } finally {
        setCancellingId(null)
      }
    })
  }

  // One row per item so the sheet can be filtered/pivoted by item
  const handleExport = () => {
    const rows = orders.flatMap((o): Record<string, string | number>[] => {
      const base = {
        'Order #': o.order_no,
        'Date & Time': fmtTime(o.created_at),
        Branch: o.branchName ?? '',
        Payment: (o.payment_mode ?? '').toUpperCase(),
        Status: o.status,
      }
      const tail = {
        'Order Total (₹)': Number(rupees(o.total_amount)),
        'Cancel Reason': o.status === 'voided' ? o.void_reason ?? '' : '',
      }
      if (o.items.length === 0) return [{ ...base, Item: '', Qty: '', 'Item Total (₹)': '', ...tail }]
      return o.items.map(i => ({ ...base, Item: i.name, Qty: i.qty, 'Item Total (₹)': Number(rupees(i.line_total)), ...tail }))
    })
    const sheet = XLSX.utils.json_to_sheet(rows)
    sheet['!cols'] = [{ wch: 9 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 9 }, { wch: 36 }, { wch: 5 }, { wch: 13 }, { wch: 15 }, { wch: 24 }]
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Sales')
    XLSX.writeFile(book, `sales-report-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="ra-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Order Records ({orders.length})</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={orders.length === 0}
          style={{ padding: '0.5rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          ⬇ Download Excel
        </button>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Time</th>
              <th>Branch</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="sa-empty">No orders recorded for this time range.</td>
              </tr>
            ) : (
              orders.slice(0, MAX_ROWS_ON_SCREEN).map(o => (
                <tr key={o.id} style={o.status === 'voided' ? { opacity: 0.6 } : undefined}>
                  <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>#{o.order_no}</td>
                  <td style={{ color: '#475569', fontSize: '0.85rem' }}>{fmtTime(o.created_at)}</td>
                  <td style={{ color: '#334155', fontSize: '0.85rem' }}>{o.branchName ?? '—'}</td>
                  <td style={{ color: '#334155', fontSize: '0.8rem', minWidth: '14rem' }}>
                    {o.items.length === 0 ? '—' : o.items.map((i, idx) => (
                      <div key={idx}>{i.name} <strong>× {i.qty}</strong></div>
                    ))}
                    {o.status === 'voided' && o.void_reason && (
                      <div style={{ color: '#b91c1c', marginTop: '0.25rem' }}>Reason: {o.void_reason}</div>
                    )}
                  </td>
                  <td>
                    <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{o.payment_mode}</span>
                  </td>
                  <td>
                    <span className={`badge ${o.status === 'settled' ? 'badge-green' : o.status === 'voided' ? 'badge-red' : 'badge-amber'}`}>
                      {o.status === 'voided' ? 'cancelled' : o.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>₹{rupees(o.total_amount)}</td>
                  <td>
                    {o.status !== 'voided' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(o)}
                        disabled={isPending && cancellingId === o.id}
                        style={{ padding: '0.3rem 0.65rem', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isPending && cancellingId === o.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {orders.length > MAX_ROWS_ON_SCREEN && (
        <div style={{ padding: '0.75rem 1.5rem', color: '#64748b', fontSize: '0.8rem', borderTop: '1px solid #e2e8f0' }}>
          Showing the latest {MAX_ROWS_ON_SCREEN} orders. Download Excel for all {orders.length}.
        </div>
      )}
    </div>
  )
}
