import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Cashier & Datewise Collection Report' }

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateReadable(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function CollectionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string; cashier?: string; branch?: string }>
}) {
  const { date = 'today', from, to, cashier = 'all', branch = 'all' } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  // Fetch branch staff for cashier filter
  const branchIds = (branches ?? []).map(b => b.id)
  let staffList: { id: string; name: string }[] = []
  if (branchIds.length > 0) {
    const { data: rawStaff } = await supabase
      .from('branch_members')
      .select('user_id, profiles ( id, name )')
      .in('branch_id', branchIds)

    const staffMap = new Map<string, string>()
    ;(rawStaff ?? []).forEach((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      if (prof?.id && prof?.name) {
        staffMap.set(prof.id, prof.name)
      }
    })
    staffList = Array.from(staffMap.entries()).map(([id, name]) => ({ id, name }))
  }

  // Calculate Date Range
  const now = new Date()
  let startDate: Date
  let endDate: Date
  let activePreset = date
  let fromInputValue = ''
  let toInputValue = ''

  if (from || to) {
    activePreset = 'custom'
    const fromD = from ? new Date(from + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const toD = to ? new Date(to + 'T23:59:59.999') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    startDate = isNaN(fromD.getTime()) ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0) : fromD
    endDate = isNaN(toD.getTime()) ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) : toD
    fromInputValue = formatYMD(startDate)
    toInputValue = formatYMD(endDate)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Specific single date passed via ?date=YYYY-MM-DD
    const d = new Date(date + 'T00:00:00')
    if (!isNaN(d.getTime())) {
      startDate = new Date(date + 'T00:00:00')
      endDate = new Date(date + 'T23:59:59.999')
      fromInputValue = date
      toInputValue = date
      activePreset = date === formatYMD(now) ? 'today' : 'custom'
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      fromInputValue = formatYMD(now)
      toInputValue = formatYMD(now)
    }
  } else if (date === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    startDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0)
    endDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999)
    fromInputValue = formatYMD(yest)
    toInputValue = formatYMD(yest)
  } else if (date === '7d') {
    const d7 = new Date(now)
    d7.setDate(d7.getDate() - 6)
    startDate = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0, 0)
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    fromInputValue = formatYMD(d7)
    toInputValue = formatYMD(now)
  } else if (date === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    fromInputValue = formatYMD(startDate)
    toInputValue = formatYMD(now)
  } else {
    // Default: today
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    fromInputValue = formatYMD(now)
    toInputValue = formatYMD(now)
    activePreset = 'today'
  }

  const isSingleDay = fromInputValue === toInputValue

  // Query settled orders in date range
  let query = supabase
    .from('orders')
    .select(`
      id, order_no, total_amount, payment_mode, status, created_at, cashier_id, branch_id,
      branches ( name ),
      profiles:cashier_id ( name )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('status', 'settled')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (branch !== 'all') {
    query = query.eq('branch_id', branch)
  }
  if (cashier !== 'all') {
    if (cashier === 'unassigned') {
      query = query.is('cashier_id', null)
    } else {
      query = query.eq('cashier_id', cashier)
    }
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

  // Datewise breakdown
  const perDay: {
    [dateStr: string]: {
      date: string
      displayDate: string
      dayName: string
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

    // Cashier grouping
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

    // Day grouping
    const orderDate = new Date(o.created_at)
    const dayKey = formatYMD(orderDate)
    if (!perDay[dayKey]) {
      perDay[dayKey] = {
        date: dayKey,
        displayDate: orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        dayName: orderDate.toLocaleDateString('en-IN', { weekday: 'short' }),
        ordersCount: 0,
        cash: 0,
        upi: 0,
        card: 0,
        total: 0,
      }
    }
    perDay[dayKey].ordersCount += 1
    perDay[dayKey].total += amount
    if (mode === 'cash') perDay[dayKey].cash += amount
    else if (mode === 'upi') perDay[dayKey].upi += amount
    else if (mode === 'card') perDay[dayKey].card += amount
  })

  // Sorted days list (newest first)
  const sortedDays = Object.values(perDay).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/restaurant/reports" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              ← All Reports
            </Link>
          </div>
          <h1 style={{ color: '#0f172a' }}>Cashier &amp; Datewise Collection Report</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Daily cash drawer handover, digital payment collection, datewise breakdown, and cashier audits
          </p>
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', flexWrap: 'wrap' }}>
          {[
            { key: 'today',     label: "Today" },
            { key: 'yesterday', label: 'Yesterday' },
            { key: '7d',        label: 'Last 7 Days' },
            { key: 'month',     label: 'This Month' },
          ].map(d => (
            <Link
              key={d.key}
              href={`/restaurant/reports/collection?date=${d.key}&branch=${branch}&cashier=${cashier}`}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                fontSize: '0.825rem',
                textDecoration: 'none',
                color: activePreset === d.key ? '#ffffff' : '#475569',
                background: activePreset === d.key ? '#2563eb' : 'transparent',
                fontWeight: activePreset === d.key ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Datewise Selection & Filter Toolbar */}
      <div
        className="ra-section"
        style={{
          marginBottom: '1.5rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.875rem',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form method="GET" action="/restaurant/reports/collection" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          {/* From Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              From Date
            </label>
            <input
              type="date"
              name="from"
              defaultValue={fromInputValue}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            />
          </div>

          {/* To Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              To Date
            </label>
            <input
              type="date"
              name="to"
              defaultValue={toInputValue}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            />
          </div>

          {/* Branch Filter */}
          {branches && branches.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Branch
              </label>
              <select
                name="branch"
                defaultValue={branch}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.875rem',
                }}
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cashier Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              Cashier / Staff
            </label>
            <select
              name="cashier"
              defaultValue={cashier}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.875rem',
              }}
            >
              <option value="all">All Staff / POS Counters</option>
              <option value="unassigned">Direct Counter / Unassigned</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              style={{
                padding: '0.55rem 1.15rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Filter Report
            </button>
            <Link
              href="/restaurant/reports/collection"
              style={{
                padding: '0.55rem 0.9rem',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              Reset to Today
            </Link>
          </div>
        </form>

        {/* Active Filter Scope Indicator */}
        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅</span>
            <strong>
              {isSingleDay
                ? `Date: ${formatDateReadable(startDate)}`
                : `Period: ${formatDateReadable(startDate)} — ${formatDateReadable(endDate)}`}
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
              {orders.length} settled transaction{orders.length === 1 ? '' : 's'}
            </span>
          </div>

          {isSingleDay && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(() => {
                const prev = new Date(startDate)
                prev.setDate(prev.getDate() - 1)
                const next = new Date(startDate)
                next.setDate(next.getDate() + 1)
                return (
                  <>
                    <Link
                      href={`/restaurant/reports/collection?date=${formatYMD(prev)}&branch=${branch}&cashier=${cashier}`}
                      style={{
                        padding: '0.25rem 0.6rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.78rem',
                        color: '#475569',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      ← Prev Day ({formatYMD(prev)})
                    </Link>
                    <Link
                      href={`/restaurant/reports/collection?date=${formatYMD(next)}&branch=${branch}&cashier=${cashier}`}
                      style={{
                        padding: '0.25rem 0.6rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.78rem',
                        color: '#475569',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Next Day ({formatYMD(next)}) →
                    </Link>
                  </>
                )
              })()}
            </div>
          )}
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

      {/* Datewise Breakdown (if more than 1 day or multiple days of data) */}
      {!isSingleDay && sortedDays.length > 0 && (
        <div className="ra-section" style={{ marginBottom: '2rem', padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Datewise Collection Summary</h2>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.15rem' }}>Daily summary across the selected period</p>
            </div>
            <span className="badge badge-blue">{sortedDays.length} day{sortedDays.length === 1 ? '' : 's'} with sales</span>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Cash Collection</th>
                  <th>UPI Collection</th>
                  <th>Card Collection</th>
                  <th>Total Collection</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedDays.map(day => (
                  <tr key={day.date}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {day.displayDate} <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>({day.dayName})</span>
                    </td>
                    <td>
                      <span className="badge badge-blue">{day.ordersCount}</span>
                    </td>
                    <td style={{ color: '#16a34a', fontFamily: 'monospace', fontWeight: 600 }}>
                      ₹{day.cash.toFixed(2)}
                    </td>
                    <td style={{ color: '#4f46e5', fontFamily: 'monospace', fontWeight: 600 }}>
                      ₹{day.upi.toFixed(2)}
                    </td>
                    <td style={{ color: '#d97706', fontFamily: 'monospace', fontWeight: 600 }}>
                      ₹{day.card.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      ₹{day.total.toFixed(2)}
                    </td>
                    <td>
                      <Link
                        href={`/restaurant/reports/collection?date=${day.date}&branch=${branch}&cashier=${cashier}`}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#2563eb',
                          textDecoration: 'none',
                          padding: '0.25rem 0.5rem',
                          background: '#eff6ff',
                          borderRadius: '0.375rem',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        Inspect Day →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cashier Handover Summary Cards */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Cashier Handover Breakdown</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.15rem' }}>Cash drawer totals per cashier for end-of-shift handover</p>
          </div>
        </div>

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
                <th>Date &amp; Time</th>
                <th>Branch</th>
                <th>Cashier</th>
                <th>Payment Mode</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-empty">No transactions found for this date selection.</td>
                </tr>
              ) : (
                orders.map((o: any) => {
                  const oDate = new Date(o.created_at)
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>#{o.order_no}</td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {formatDateReadable(oDate)}, {oDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.85rem' }}>
                        {o.branches?.name ?? '—'}
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
