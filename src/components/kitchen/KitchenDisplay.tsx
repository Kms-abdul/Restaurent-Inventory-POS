'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { updateFulfillmentStatus } from '@/app/actions/orders'
import type { Order, OrderItem } from '@/types/database'

type OrderWithItems = Order & { order_items: OrderItem[] }

const STATUS_FLOW = {
  pending: 'cooking',
  cooking: 'ready',
  ready: 'served',
} as const

const STATUS_LABELS = {
  pending: { label: 'Pending', next: 'Start Cooking', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  cooking: { label: 'Cooking', next: 'Mark Ready', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  ready: { label: 'Ready', next: 'Mark Served', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
} as const

interface Props {
  orders: OrderWithItems[]
  branchId: string
  canUpdate: boolean
}

export default function KitchenDisplay({ orders: initialOrders, branchId, canUpdate }: Props) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`kitchen-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        async (payload) => {
          const changed = payload.new as Order
          if (!changed) return

          if (changed.fulfillment === 'served' || changed.status !== 'active') {
            setOrders(prev => prev.filter(o => o.id !== changed.id))
          } else {
            // Re-fetch the full order with items
            const { data } = await supabase
              .from('orders')
              .select('*, order_items(*)')
              .eq('id', changed.id)
              .single()

            if (data) {
              setOrders(prev => {
                const exists = prev.find(o => o.id === data.id)
                if (exists) return prev.map(o => o.id === data.id ? data : o)
                return [data, ...prev].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
              })
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [branchId])

  const handleStatusUpdate = (orderId: string, nextStatus: 'cooking' | 'ready' | 'served') => {
    if (!canUpdate || isPending) return
    setUpdatingId(orderId)

    startTransition(async () => {
      try {
        await updateFulfillmentStatus(orderId, nextStatus)
        if (nextStatus === 'served') {
          setOrders(prev => prev.filter(o => o.id !== orderId))
        } else {
          setOrders(prev =>
            prev.map(o => o.id === orderId ? { ...o, fulfillment: nextStatus } : o)
          )
        }
      } finally {
        setUpdatingId(null)
      }
    })
  }

  const pending = orders.filter(o => o.fulfillment === 'pending')
  const cooking = orders.filter(o => o.fulfillment === 'cooking')
  const ready = orders.filter(o => o.fulfillment === 'ready')

  const renderOrders = (statusOrders: OrderWithItems[], status: 'pending' | 'cooking' | 'ready') => {
    const info = STATUS_LABELS[status]
    return statusOrders.map(order => {
      const nextStatus = STATUS_FLOW[status]
      const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
      const isLate = elapsedMin > 15

      return (
        <div key={order.id} className={`kds-card ${isLate && status !== 'ready' ? 'late' : ''}`}
          style={{ borderColor: info.color }}>
          <div className="kds-card-header">
            <div className="kds-order-no">#{order.order_no}</div>
            <div className="kds-meta">
              {order.table_number && <span className="kds-table">T: {order.table_number}</span>}
              <span className={`kds-elapsed ${isLate ? 'late-text' : ''}`}>{elapsedMin}m</span>
            </div>
          </div>

          <div className="kds-items">
            {order.order_items.map(item => (
              <div key={item.id} className="kds-item">
                <span className="kds-item-qty">{item.qty}×</span>
                <span className="kds-item-name">{item.item_name_at_sale || (item as any).item_name || (item as any).name || 'Item'}</span>
                {item.notes && <div className="kds-item-note">📌 {item.notes}</div>}
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="kds-order-note">📋 {order.notes}</div>
          )}

          {canUpdate && nextStatus && (
            <button
              className="kds-action-btn"
              style={{ background: info.color }}
              onClick={() => handleStatusUpdate(order.id, nextStatus)}
              disabled={isPending && updatingId === order.id}
              id={`kds-action-${order.id}`}
            >
              {updatingId === order.id ? '…' : info.next}
            </button>
          )}
        </div>
      )
    })
  }

  return (
    <div className="kds-root">
      <div className="kds-header">
        <h1>Kitchen Display</h1>
        <div className="kds-live-dot" aria-label="Live updates active" />
      </div>

      <div className="kds-board">
        <div className="kds-column">
          <div className="kds-column-header" style={{ borderColor: '#92400E' }}>
            <span>Pending</span>
            <span className="kds-count">{pending.length}</span>
          </div>
          <div className="kds-column-body" style={{ borderColor: '#1E293B' }}>
            {pending.length === 0
              ? <div className="kds-empty">Queue clear</div>
              : renderOrders(pending, 'pending')
            }
          </div>
        </div>

        <div className="kds-column">
          <div className="kds-column-header" style={{ borderColor: '#1D4ED8' }}>
            <span>Cooking</span>
            <span className="kds-count">{cooking.length}</span>
          </div>
          <div className="kds-column-body" style={{ borderColor: '#1E293B' }}>
            {cooking.length === 0
              ? <div className="kds-empty">Nothing on the pass</div>
              : renderOrders(cooking, 'cooking')
            }
          </div>
        </div>

        <div className="kds-column">
          <div className="kds-column-header" style={{ borderColor: '#166534' }}>
            <span>Ready</span>
            <span className="kds-count">{ready.length}</span>
          </div>
          <div className="kds-column-body" style={{ borderColor: '#1E293B' }}>
            {ready.length === 0
              ? <div className="kds-empty">Nothing plated yet</div>
              : renderOrders(ready, 'ready')
            }
          </div>
        </div>
      </div>

      <style jsx>{`
        .kds-root { display: flex; flex-direction: column; height: 100%; background: #0F172A; font-family: 'Inter', sans-serif; color: #E2E8F0; overflow: hidden; }
        .kds-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1.5rem; border-bottom: 1px solid #1E293B; flex-shrink: 0; background: #0F172A; }
        .kds-header h1 { font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800; color: #F1F5F9; letter-spacing: -0.01em; text-transform: uppercase; letter-spacing: 0.04em; }
        .kds-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; box-shadow: 0 0 10px rgba(74, 222, 128, 0.6); animation: kds-pulse 2s infinite; margin-left: auto; }
        @keyframes kds-pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)} }
        .kds-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding: 0.875rem; flex: 1; overflow: hidden; }
        .kds-column { display: flex; flex-direction: column; min-height: 0; }
        .kds-column-header { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.875rem; border-radius: 4px 4px 0 0; border-left: 3px solid; border-right: 1px solid #1E293B; border-top: 1px solid #1E293B; background: #1E293B; font-weight: 700; font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em; }
        .kds-count { background: #0F172A; border-radius: 3px; padding: 0.1rem 0.45rem; font-size: 0.78rem; color: #64748B; font-weight: 700; min-width: 22px; text-align: center; font-family: 'Outfit', sans-serif; }
        .kds-column-body { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; border-left: 1px solid #1E293B; border-right: 1px solid #1E293B; border-bottom: 1px solid #1E293B; border-radius: 0 0 4px 4px; overflow-y: auto; flex: 1; background: #020617; }
        .kds-empty { text-align: center; color: #1E293B; font-size: 0.78rem; padding: 2.5rem 1rem; font-weight: 500; }
        .kds-card { background: #1E293B; border: 1px solid #334155; border-radius: 4px; padding: 0.875rem; display: flex; flex-direction: column; gap: 0.55rem; transition: border-color 0.12s; }
        .kds-card:hover { border-color: #475569; }
        .kds-card.late { animation: kds-flash 2s ease-in-out infinite; }
        @keyframes kds-flash { 0%,100%{background:#1E293B}50%{background:#2D1515} }
        .kds-card-header { display: flex; align-items: center; justify-content: space-between; }
        .kds-order-no { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: #F1F5F9; letter-spacing: -0.02em; }
        .kds-meta { display: flex; align-items: center; gap: 0.4rem; }
        .kds-table { font-size: 0.68rem; background: #0F172A; border: 1px solid #334155; padding: 0.1rem 0.4rem; border-radius: 3px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .kds-elapsed { font-size: 0.72rem; color: #334155; font-weight: 600; }
        .kds-elapsed.late-text { color: #F87171; font-weight: 700; }
        .kds-items { display: flex; flex-direction: column; gap: 0.35rem; }
        .kds-item { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.9rem; color: #CBD5E1; }
        .kds-item-qty { font-weight: 800; color: #F59E0B; min-width: 1.5rem; font-family: 'Outfit', sans-serif; font-size: 1rem; }
        .kds-item-name { font-weight: 600; color: #E2E8F0; }
        .kds-item-note { font-size: 0.72rem; color: #D97706; padding-left: 1.9rem; font-weight: 500; }
        .kds-order-note { font-size: 0.75rem; color: #475569; padding: 0.3rem 0.5rem; background: #0F172A; border: 1px solid #1E293B; border-radius: 3px; }
        .kds-action-btn { width: 100%; padding: 0.55rem; border: none; border-radius: 4px; color: #ffffff; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: filter 0.12s; letter-spacing: 0.02em; }
        .kds-action-btn:hover:not(:disabled) { filter: brightness(1.15); }
        .kds-action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
