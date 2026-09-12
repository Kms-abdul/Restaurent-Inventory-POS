import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Cashier Collection Report' }

export default async function CollectionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cashier?: string; branch?: string }>
}) {
  const { date = 'today', cashier = 'all', branch = 'all' } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  // Calculate date range
  const start = new Date()
  if (date === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (date === 'yesterday') {
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
  } else if (date === '7d') {
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setHours(0, 0, 0, 0)
  }

  let query = supabase
    .from('orders')
    .select(`
      id, order_no, total_amount, payment_mode, status, created_at, cashier_id, branch_id,
      branches ( name ),
      profiles:cashier_id ( name )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('status', 'settled')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })

  if (branch !== 'all') {
    query = query.eq('branch_id', branch)
  }
  if (cashier !== 'all') {
    query = query.eq('cashier_id', cashier)
  }

  const { data: ordersData } = await query
  const orders = ordersData ?? []

  // Aggregations
  let totalCash = 0
  let totalUpi = 0
  let totalCard = 0
  let grandTotal = 0

  // Per cashier breakdown
  const perCashier: {
    [cashierId: string]: {
      name: string
      ordersCount: number
      cash: number
      upi: number
      card: number
      total: number
    }
  } = {}

  orders.forEach((o: any) => {
    const amount = (o.total_amount || 0) / 100
    grandTotal += amount
    const mode = (o.payment_mode || 'cash').toLowerCase()

    if (mode === 'cash') totalCash += amount
    else if (mode === 'upi') totalUpi += amount
    else if (mode === 'card') totalCard += amount

    const cId = o.cashier_id || 'unassigned'
    const cName = o.profiles?.name || (cId === 'unassigned' ? 'Counter POS' : 'Staff')

    if (!perCashier[cId]) {
      perCashier[cId] = {
        name: cName,
        ordersCount: 0,
        cash: 0,
        upi: 0,
        card: 0,
        total: 0,
      }
    }

    perCashier[cId].ordersCount += 1
    perCashier[cId].total += amount
    if (mode === 'cash') perCashier[cId].cash += amount
    else if (mode === 'upi') perCashier[cId].upi += amount
    else if (mode === 'card') perCashier[cId].card += amount
  })

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/restaurant/reports" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              ← Reports
            </Link>
          </div>
          <h1 style={{ color: '#0f172a' }}>Cashier &amp; Shift Collection Report</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Daily cash drawer handover, digital payment collection, and shift breakdown
          </p>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
          {[
            { key: 'today',     label: "Today's Shift" },
            { key: 'yesterday', label: 'Yesterday' },
            { key: '7d',        label: 'Last 7 Days' },
          ].map(d => (
            <Link
              key={d.key}
              href={`/restaurant/reports/collection?date=${d.key}&branch=${branch}&cashier=${cashier}`}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.825rem',
                textDecoration: 'none',
                color: date === d.key ? '#ffffff' : '#475569',
                background: date === d.key ? '#2563eb' : 'transparent',
                fontWeight: date === d.key ? 700 : 500,
              }}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Cards: Payment Split */}
      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="kpi-card kpi-revenue">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <div className="kpi-label">Total Collection</div>
            <div className="kpi-value">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="kpi-card kpi-ok">
          <div className="kpi-icon">💵</div>
          <div className="kpi-content">
            <div className="kpi-label">Cash in Drawer</div>
            <div className="kpi-value" style={{ color: '#16a34a' }}>₹{totalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="kpi-card kpi-kitchen">
          <div className="kpi-icon">📱</div>
          <div className="kpi-content">
            <div className="kpi-label">UPI / QR Digital</div>
            <div className="kpi-value" style={{ color: '#4f46e5' }}>₹{totalUpi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="kpi-card kpi-orders">
          <div className="kpi-icon">💳</div>
          <div className="kpi-content">
            <div className="kpi-label">Card Payments</div>
            <div className="kpi-value" style={{ color: '#d97706' }}>₹{totalCard.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Cashier Handover Summary Cards */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Cashier Handover Breakdown</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {Object.entries(perCashier).length === 0 ? (
            <p style={{ color: '#64748b', padding: '1rem 0' }}>No settled orders recorded for this period.</p>
          ) : (
            Object.entries(perCashier).map(([cId, c]) => (
              <div
                key={cId}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>🧑‍💼 {c.name}</div>
                  <span className="badge badge-blue">{c.ordersCount} orders</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>💵 Cash Handover:</span>
                    <strong style={{ color: '#16a34a', fontFamily: 'monospace' }}>₹{c.cash.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>📱 UPI Collection:</span>
                    <strong style={{ color: '#4f46e5', fontFamily: 'monospace' }}>₹{c.upi.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>💳 Card Collection:</span>
                    <strong style={{ color: '#d97706', fontFamily: 'monospace' }}>₹{c.card.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem', color: '#0f172a' }}>
                    <strong>Total Collected:</strong>
                    <strong style={{ fontSize: '1rem', color: '#0f172a', fontFamily: 'monospace' }}>₹{c.total.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Individual Transactions Log */}
      <div className="ra-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Collection Audit Log ({orders.length} orders)</h2>
        </div>

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Cashier</th>
                <th>Payment Mode</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">No transactions found.</td>
                </tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>#{o.order_no}</td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: '#0f172a', fontWeight: 600 }}>{o.profiles?.name ?? 'Counter Staff'}</td>
                    <td>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: o.payment_mode === 'cash' ? '#16a34a' : o.payment_mode === 'upi' ? '#4f46e5' : '#d97706',
                        }}
                      >
                        {o.payment_mode}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                      ₹{(Number(o.total_amount) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
