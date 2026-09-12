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
          <div className="kds-column-header" style={{ borderColor: '#f59e0b' }}>
            <span>⏳ Pending</span>
            <span className="kds-count">{pending.length}</span>
          </div>
          <div className="kds-column-body">
            {pending.length === 0
              ? <div className="kds-empty">No pending orders</div>
              : renderOrders(pending, 'pending')
            }
          </div>
        </div>

        <div className="kds-column">
          <div className="kds-column-header" style={{ borderColor: '#3b82f6' }}>
            <span>🔥 Cooking</span>
            <span className="kds-count">{cooking.length}</span>
          </div>
          <div className="kds-column-body">
            {cooking.length === 0
              ? <div className="kds-empty">Nothing cooking</div>
              : renderOrders(cooking, 'cooking')
            }
          </div>
        </div>

        <div className="kds-column">
          <div className="kds-column-header" style={{ borderColor: '#22c55e' }}>
            <span>✅ Ready</span>
            <span className="kds-count">{ready.length}</span>
          </div>
          <div className="kds-column-body">
            {ready.length === 0
              ? <div className="kds-empty">Nothing ready</div>
              : renderOrders(ready, 'ready')
            }
          </div>
        </div>
      </div>

      <style jsx>{`
        .kds-root { display: flex; flex-direction: column; height: 100%; background: #f8fafc; font-family: 'Inter', sans-serif; color: #0f172a; overflow: hidden; }
        .kds-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; background: #ffffff; }
        .kds-header h1 { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; color: #0f172a; }
        .kds-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 8px rgba(22, 163, 74, 0.6); animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .kds-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1rem; flex: 1; overflow: hidden; }
        .kds-column { display: flex; flex-direction: column; min-height: 0; }
        .kds-column-header { display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 1rem; border-radius: 0.75rem 0.75rem 0 0; border: 1px solid; border-bottom: none; background: #ffffff; font-weight: 700; font-size: 0.9rem; color: #0f172a; }
        .kds-count { background: #f1f5f9; border-radius: 1rem; padding: 0.1rem 0.55rem; font-size: 0.8rem; color: #334155; font-weight: 700; }
        .kds-column-body { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 0.75rem 0.75rem; overflow-y: auto; flex: 1; background: #f1f5f9; }
        .kds-empty { text-align: center; color: #94a3b8; font-size: 0.875rem; padding: 2rem; font-weight: 500; }
        .kds-card { background: #ffffff; border: 1.5px solid; border-radius: 0.85rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
        .kds-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .kds-card.late { animation: flash 2s ease-in-out infinite; }
        @keyframes flash { 0%,100%{background:#ffffff}50%{background:#fef2f2} }
        .kds-card-header { display: flex; align-items: center; justify-content: space-between; }
        .kds-order-no { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 800; color: #0f172a; }
        .kds-meta { display: flex; align-items: center; gap: 0.5rem; }
        .kds-table { font-size: 0.78rem; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 0.15rem 0.5rem; border-radius: 0.35rem; color: #334155; font-weight: 600; }
        .kds-elapsed { font-size: 0.8rem; color: #64748b; font-weight: 500; }
        .kds-elapsed.late-text { color: #dc2626; font-weight: 700; }
        .kds-items { display: flex; flex-direction: column; gap: 0.4rem; }
        .kds-item { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.9rem; color: #1e293b; }
        .kds-item-qty { font-weight: 800; color: #7c3aed; min-width: 1.5rem; }
        .kds-item-name { font-weight: 600; }
        .kds-item-note { font-size: 0.78rem; color: #b45309; padding-left: 1.9rem; font-weight: 500; }
        .kds-order-note { font-size: 0.8rem; color: #475569; padding: 0.4rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.4rem; }
        .kds-action-btn { width: 100%; padding: 0.6rem; border: none; border-radius: 0.6rem; color: #ffffff; font-weight: 700; font-size: 0.875rem; cursor: pointer; opacity: 0.95; transition: opacity 0.15s, box-shadow 0.15s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .kds-action-btn:hover:not(:disabled) { opacity: 1; box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .kds-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
