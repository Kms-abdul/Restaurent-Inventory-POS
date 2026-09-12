import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Reports & Analytics' }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string }>
}) {
  const { range = '30d', branch = 'all' } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Branches for filter dropdown
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  // Calculate date filter
  let startDate = new Date()
  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0)
  } else if (range === '7d') {
    startDate.setDate(startDate.getDate() - 7)
  } else if (range === '30d') {
    startDate.setDate(startDate.getDate() - 30)
  } else {
    startDate = new Date(0)
  }

  // Query orders
  let query = supabase
    .from('orders')
    .select(`
      id, order_no, total_amount, discount_amount, status, payment_mode, fulfillment, source, created_at, branch_id,
      branches ( name )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })

  if (branch !== 'all') {
    query = query.eq('branch_id', branch)
  }

  const { data: ordersData } = await query
  const orders = ordersData ?? []

  // Metrics
  const settledOrders = orders.filter(o => o.status === 'settled')
  const totalRevenuePaise = settledOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
  const totalRevenueRupees = totalRevenuePaise / 100
  const avgOrderRupees = settledOrders.length > 0 ? (totalRevenueRupees / settledOrders.length) : 0
  const voidedOrders = orders.filter(o => o.status === 'voided')

  // Payment Breakdown
  const paymentBreakdown: { [mode: string]: { count: number; total: number } } = {
    cash: { count: 0, total: 0 },
    upi:  { count: 0, total: 0 },
    card: { count: 0, total: 0 },
  }
  settledOrders.forEach(o => {
    const mode = (o.payment_mode || 'cash').toLowerCase()
    if (!paymentBreakdown[mode]) paymentBreakdown[mode] = { count: 0, total: 0 }
    paymentBreakdown[mode].count += 1
    paymentBreakdown[mode].total += (o.total_amount || 0) / 100
  })

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Reports &amp; Insights</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Comprehensive sales performance, payment splits, and order volume
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.25rem', border: '1px solid #cbd5e1' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: '7d',    label: '7 Days' },
              { key: '30d',   label: '30 Days' },
              { key: 'all',   label: 'All Time' },
            ].map(r => (
              <Link
                key={r.key}
                href={`/restaurant/reports?range=${r.key}&branch=${branch}`}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  color: range === r.key ? '#ffffff' : '#475569',
                  background: range === r.key ? '#2563eb' : 'transparent',
                  fontWeight: range === r.key ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {r.label}
              </Link>
            ))}
          </div>

          {(branches ?? []).length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <select
                value={branch}
                onChange={undefined}
                style={{
                  padding: '0.5rem 0.8rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                }}
              >
                <option value="all">All Branches</option>
                {branches?.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="kpi-card kpi-revenue">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <div className="kpi-label">Total Revenue</div>
            <div className="kpi-value">₹{totalRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="kpi-card kpi-orders">
          <div className="kpi-icon">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Settled Orders</div>
            <div className="kpi-value">{settledOrders.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ {orders.length}</span></div>
          </div>
        </div>

        <div className="kpi-card kpi-kitchen">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <div className="kpi-label">Average Order Value</div>
            <div className="kpi-value">₹{avgOrderRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="kpi-card kpi-ok">
          <div className="kpi-icon">🚫</div>
          <div className="kpi-content">
            <div className="kpi-label">Voided Orders</div>
            <div className="kpi-value">{voidedOrders.length}</div>
          </div>
        </div>
      </div>

      {/* Payment Modes Grid */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>Payment Methods Distribution</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {[
            { key: 'cash', label: 'Cash Payments', icon: '💵', color: '#16a34a' },
            { key: 'upi',  label: 'UPI / QR',       icon: '📱', color: '#4f46e5' },
            { key: 'card', label: 'Cards',          icon: '💳', color: '#d97706' },
          ].map(m => {
            const data = paymentBreakdown[m.key] || { count: 0, total: 0 }
            const pct = totalRevenueRupees > 0 ? ((data.total / totalRevenueRupees) * 100).toFixed(1) : '0'
            return (
              <div key={m.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{m.label}</div>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                  ₹{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
                  <span>{data.count} transactions</span>
                  <span style={{ color: m.color, fontWeight: 700 }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Orders History Table */}
      <div className="ra-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Order Records ({orders.length})</h2>
        </div>

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Branch</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-empty">
                    No orders recorded for this time range.
                  </td>
                </tr>
              ) : (
                orders.slice(0, 50).map((o: any) => {
                  const branchName = Array.isArray(o.branches) ? o.branches[0]?.name : o.branches?.name
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        #{o.order_no}
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.85rem' }}>
                        {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ color: '#334155', fontSize: '0.85rem' }}>
                        {branchName ?? '—'}
                      </td>
                      <td>
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                          {o.payment_mode}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${o.status === 'settled' ? 'badge-green' : o.status === 'voided' ? 'badge-red' : 'badge-amber'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                        ₹{(Number(o.total_amount) / 100).toFixed(2)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
