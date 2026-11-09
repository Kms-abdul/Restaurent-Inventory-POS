'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markDueOrderPaid } from '@/app/actions/orders'

export interface DueOrder {
  id: string
  order_no: number
  created_at: string
  branchName: string | null
  table_number: string | null
  payment_mode: string
  notes: string | null
  total_amount: number // paise
  items: { name: string; qty: number; line_total: number }[]
}

type Tab = 'due' | 'paid'
type PaidMode = 'cash' | 'upi' | 'card'

const PAID_MODES: { key: PaidMode; label: string }[] = [
  { key: 'cash', label: '💵 Cash' },
  { key: 'upi', label: '📱 UPI' },
  { key: 'card', label: '💳 Card' },
]

const rupees = (paise: number) => (Number(paise || 0) / 100).toFixed(2)
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
const paidNote = (notes: string | null) => notes?.match(/\[Due paid: ([^\]]+)\]/)?.[1] ?? ''

export default function DueBills({ due, paid }: { due: DueOrder[]; paid: DueOrder[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('due')
  const [search, setSearch] = useState('')

  const handlePaid = (o: DueOrder, mode: PaidMode) => {
    if (!window.confirm(`Mark order #${o.order_no} (₹${rupees(o.total_amount)}) as paid by ${mode.toUpperCase()}?`)) return
    setBusyId(o.id)
    startTransition(async () => {
      try {
        await markDueOrderPaid(o.id, mode)
        router.refresh()
      } catch (err) {
        alert('Could not mark as paid: ' + (err instanceof Error ? err.message : 'Unknown error'))
      } finally {
        setBusyId(null)
      }
    })
  }

  const q = search.trim().toLowerCase()
  const rows = (tab === 'due' ? due : paid).filter(o =>
    !q || String(o.order_no).includes(q) || (o.table_number ?? '').toLowerCase().includes(q) || (o.notes ?? '').toLowerCase().includes(q)
  )

  return (
    <div className="db-box">
      <div className="db-toolbar">
        <div className="db-tabs">
          <button type="button" className={tab === 'due' ? 'db-tab db-tab-active' : 'db-tab'} onClick={() => setTab('due')}>Unpaid ({due.length})</button>
          <button type="button" className={tab === 'paid' ? 'db-tab db-tab-active' : 'db-tab'} onClick={() => setTab('paid')}>Recently Paid ({paid.length})</button>
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search order # or table"
          className="db-search"
        />
      </div>

      {rows.length === 0 ? (
        <p className="db-empty">{tab === 'due' ? 'No unpaid bills.' : 'No paid Due bills yet.'}</p>
      ) : (
        <div className="db-grid">
          {rows.map(o => (
            <div key={o.id} className="db-card">
              <div className="db-card-top">
                <div>
                  <div className="db-order">#{o.order_no}{o.table_number ? ` · ${o.table_number}` : ''}</div>
                  <div className="db-meta">{fmtTime(o.created_at)}{o.branchName ? ` · ${o.branchName}` : ''}</div>
                </div>
                <div className="db-amount">₹{rupees(o.total_amount)}</div>
              </div>

              <div className="db-items">
                {o.items.map((i, idx) => <div key={idx}>{i.name} <strong>× {i.qty}</strong></div>)}
              </div>

              {tab === 'due' ? (
                <div className="db-actions">
                  {PAID_MODES.map(m => (
                    <button key={m.key} type="button" disabled={isPending} onClick={() => handlePaid(o, m.key)}>
                      {busyId === o.id ? '…' : m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="db-paid">✓ Paid: {paidNote(o.notes) || o.payment_mode.toUpperCase()}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .db-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; }
        .db-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .db-tabs { display: flex; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.25rem; }
        .db-tab { padding: 0.4rem 0.8rem; border: none; border-radius: 0.375rem; background: transparent; color: #475569; font-size: 0.8rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .db-tab-active { background: #2563eb; color: #fff; font-weight: 700; }
        .db-search { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; color: #0f172a; min-width: 14rem; }
        .db-empty { color: #64748b; text-align: center; padding: 2rem 0; }
        .db-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.85rem; }
        .db-card { border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; background: #f8fafc; display: flex; flex-direction: column; gap: 0.65rem; }
        .db-card-top { display: flex; justify-content: space-between; gap: 0.75rem; }
        .db-order { font-weight: 800; color: #0f172a; font-family: monospace; }
        .db-meta { color: #64748b; font-size: 0.78rem; margin-top: 0.15rem; }
        .db-amount { font-weight: 800; color: #dc2626; font-size: 1.1rem; white-space: nowrap; }
        .db-items { color: #334155; font-size: 0.82rem; flex: 1; }
        .db-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
        .db-actions button { padding: 0.55rem 0.25rem; background: #fff; color: #047857; border: 1px solid #a7f3d0; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .db-actions button:hover:not(:disabled) { background: #ecfdf5; }
        .db-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .db-paid { color: #047857; font-size: 0.82rem; font-weight: 700; }
        @media (max-width: 768px) {
          .db-box { padding: 0.85rem; }
          .db-grid { grid-template-columns: 1fr; }
          .db-tabs, .db-search { width: 100%; min-width: 0; }
          .db-tab { flex: 1; }
        }
      `}</style>
    </div>
  )
}
