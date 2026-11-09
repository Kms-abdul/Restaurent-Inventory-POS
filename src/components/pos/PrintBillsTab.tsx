'use client'

import { useCallback, useEffect, useState } from 'react'
import { listOrders } from '@/app/actions/orders'
import { businessDayStart, businessToday } from '@/utils/business-day'

export interface BillOrder {
  id: string
  order_no: number
  created_at: string
  status: string
  payment_mode: string | null
  table_number: string | null
  total_amount: number // paise
  discount_amount: number | null // paise
  order_items?: {
    id?: string
    item_name_at_sale?: string
    item_name?: string
    qty?: number
    unit_price_at_sale?: number
    unit_price?: number
    line_total?: number
  }[]
}

const rupees = (paise: number) => (Number(paise || 0) / 100).toFixed(2)
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
const modeLabel = (o: BillOrder) => {
  if (o.status === 'active') return 'OPEN'
  return o.payment_mode === 'swiggy_zomato' ? 'SWIGGY/ZOMATO' : (o.payment_mode ?? '').toUpperCase()
}

export default function PrintBillsTab({
  branchId,
  dayEndHour,
  onPrint,
}: {
  branchId: string
  dayEndHour: number
  onPrint: (order: BillOrder) => Promise<void>
}) {
  const [orders, setOrders] = useState<BillOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const since = businessDayStart(businessToday(dayEndHour), dayEndHour).toISOString()
      const rows = (await listOrders(branchId, { since, limit: 1000 })) as unknown as BillOrder[]
      setOrders(rows.filter(o => o.status !== 'voided'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders')
    } finally {
      setLoading(false)
    }
  }, [branchId, dayEndHour])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const handlePrint = async (o: BillOrder) => {
    setPrintingId(o.id)
    try {
      await onPrint(o)
    } catch (err) {
      alert('Could not print bill: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setPrintingId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const rows = orders.filter(o =>
    !q || String(o.order_no).includes(q) || (o.table_number ?? '').toLowerCase().includes(q)
  )

  return (
    <div className="pb-wrap">
      <div className="pb-toolbar">
        <h2 className="pb-title">🧾 Today&apos;s Bills ({orders.length})</h2>
        <div className="pb-tools">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order # or table"
            className="pb-search"
          />
          <button type="button" className="pb-refresh" onClick={() => void load()} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <p className="pb-error">{error}</p>}

      {loading && orders.length === 0 ? (
        <p className="pb-empty">Loading today&apos;s orders…</p>
      ) : rows.length === 0 ? (
        <p className="pb-empty">No orders found for today.</p>
      ) : (
        <div className="pb-list">
          {rows.map(o => (
            <div key={o.id} className="pb-row">
              <div className="pb-main">
                <div className="pb-order">
                  #{o.order_no}
                  {o.table_number ? <span className="pb-table">{o.table_number}</span> : null}
                  <span className={o.status === 'active' ? 'pb-mode pb-mode-open' : 'pb-mode'}>{modeLabel(o)}</span>
                </div>
                <div className="pb-items">
                  {(o.order_items ?? []).map(i => `${i.item_name_at_sale || i.item_name || 'Item'} × ${i.qty ?? 1}`).join(', ')}
                </div>
                <div className="pb-time">{fmtTime(o.created_at)}</div>
              </div>
              <div className="pb-side">
                <div className="pb-amount">₹{rupees(o.total_amount)}</div>
                <button type="button" className="pb-print" disabled={printingId === o.id} onClick={() => void handlePrint(o)}>
                  {printingId === o.id ? 'Printing…' : '🖨️ Print Bill'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .pb-wrap { max-width: 1000px; margin: 0 auto; padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
        .pb-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.85rem; }
        .pb-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; }
        .pb-tools { display: flex; gap: 0.5rem; }
        .pb-search { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; color: #0f172a; min-width: 14rem; }
        .pb-refresh { padding: 0.5rem 0.8rem; background: #fff; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.82rem; font-weight: 600; color: #334155; cursor: pointer; white-space: nowrap; }
        .pb-error { color: #b91c1c; font-size: 0.875rem; }
        .pb-empty { color: #64748b; text-align: center; padding: 2.5rem 0; }
        .pb-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: calc(100vh - 230px); overflow-y: auto; padding-right: 0.25rem; }
        .pb-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem 0.9rem; border: 1px solid #e2e8f0; border-radius: 0.6rem; background: #f8fafc; }
        .pb-main { min-width: 0; flex: 1; }
        .pb-order { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-weight: 800; color: #0f172a; font-family: monospace; }
        .pb-table { font-family: inherit; font-size: 0.75rem; background: #fef3c7; color: #92400e; padding: 0.1rem 0.4rem; border-radius: 0.3rem; }
        .pb-mode { font-size: 0.7rem; font-weight: 700; color: #475569; background: #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 0.3rem; }
        .pb-mode-open { background: #dbeafe; color: #1d4ed8; }
        .pb-items { color: #334155; font-size: 0.82rem; margin-top: 0.2rem; }
        .pb-time { color: #64748b; font-size: 0.75rem; margin-top: 0.15rem; }
        .pb-side { display: flex; align-items: center; gap: 0.85rem; flex-shrink: 0; }
        .pb-amount { font-weight: 800; color: #0f172a; white-space: nowrap; }
        .pb-print { padding: 0.5rem 0.85rem; background: #2563eb; color: #fff; border: none; border-radius: 0.5rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .pb-print:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 768px) {
          .pb-wrap { margin: 0.5rem; padding: 0.75rem; }
          .pb-tools, .pb-search { width: 100%; min-width: 0; }
          .pb-search { flex: 1; font-size: 16px; }
          .pb-row { flex-direction: column; align-items: stretch; gap: 0.55rem; }
          .pb-side { justify-content: space-between; }
          .pb-list { max-height: calc(100dvh - 290px); min-height: 200px; }
        }
      `}</style>
    </div>
  )
}
