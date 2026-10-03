import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { getDailyInventoryLedger } from '@/app/actions/inventory-daily'

export const metadata = { title: 'Daily Stock Report' }

export default async function DailyStockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string }>
}) {
  const { branch: requestedBranchId, date: requestedDate } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // 1. Fetch branches for this restaurant
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const branchList = branches ?? []
  if (branchList.length === 0) {
    return (
      <div className="ra-page">
        <h1 style={{ color: '#0f172a' }}>Daily Stock Report</h1>
        <p style={{ color: '#64748b', marginTop: '1rem' }}>No branches configured yet.</p>
      </div>
    )
  }

  const activeBranch = requestedBranchId
    ? branchList.find(b => b.id === requestedBranchId) ?? branchList[0]
    : branchList[0]

  // 2. Business date setup (defaults to today)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayDate = new Date(Date.now() - 86400000)
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10)
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayStr

  // 3. Fetch Day-wise Inventory Ledger data
  const ledger = await getDailyInventoryLedger(activeBranch.id, selectedDate)

  // Calculate totals
  const totalOpening = ledger.items.reduce((acc, i) => acc + i.opening_stock, 0)
  const totalBought = ledger.items.reduce((acc, i) => acc + i.stock_in, 0)
  const totalAvailable = ledger.items.reduce((acc, i) => acc + (i.opening_stock + i.stock_in), 0)
  const totalUsed = ledger.items.reduce((acc, i) => acc + i.stock_consumed + i.wastage, 0)
  const totalClosing = ledger.items.reduce((acc, i) => acc + i.expected_closing, 0)

  return (
    <div className="ra-page">
      {/* Header */}
      <div className="ra-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <Link href="/restaurant/inventory" className="btn-ghost-sm">
              ← Back to Inventory
            </Link>
            <Link href="/restaurant/inventory/audit" className="btn-ghost-sm">
              Go to EOD Stock Audit →
            </Link>
          </div>
          <h1>Daily Stock Report</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Stock balance for <strong>{activeBranch.name}</strong> on <strong>{selectedDate}</strong>
          </p>
        </div>

        {/* Date & Branch Controls */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Branch Switcher */}
          {branchList.length > 1 && (
            <div className="clean-seg-control">
              {branchList.map(b => (
                <Link
                  key={b.id}
                  href={`/restaurant/inventory/daily?branch=${b.id}&date=${selectedDate}`}
                  className={`clean-seg-item ${activeBranch.id === b.id ? 'active' : ''}`}
                >
                  {b.name}
                </Link>
              ))}
            </div>
          )}

          {/* Quick Date Switcher */}
          <div className="clean-seg-control">
            <Link
              href={`/restaurant/inventory/daily?branch=${activeBranch.id}&date=${todayStr}`}
              className={`clean-seg-item ${selectedDate === todayStr ? 'active' : ''}`}
            >
              Today
            </Link>
            <Link
              href={`/restaurant/inventory/daily?branch=${activeBranch.id}&date=${yesterdayStr}`}
              className={`clean-seg-item ${selectedDate === yesterdayStr ? 'active' : ''}`}
            >
              Yesterday
            </Link>
          </div>

          {/* Date Picker Form */}
          <form method="GET" style={{ display: 'inline-flex', gap: '0.35rem', margin: 0, alignItems: 'center' }}>
            <input type="hidden" name="branch" value={activeBranch.id} />
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                color: '#0f172a',
                background: '#ffffff',
              }}
            />
            <button
              type="submit"
              className="btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              Go
            </button>
          </form>

          <Link href="/restaurant/inventory/stock-in" className="btn-secondary" style={{ fontSize: '0.825rem' }}>
            + Record Stock In
          </Link>
        </div>
      </div>

      {/* Clean Stat Metric Cards */}
      <div className="clean-stat-grid">
        <div className="clean-stat-card">
          <span className="clean-stat-label">Opening Stock</span>
          <span className="clean-stat-val">{totalOpening.toFixed(2)}</span>
          <span className="clean-stat-sub">Carried over from yesterday</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Stock Added (+)</span>
          <span className="clean-stat-val">{totalBought.toFixed(2)}</span>
          <span className="clean-stat-sub">Inward deliveries today</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Total Available</span>
          <span className="clean-stat-val">{totalAvailable.toFixed(2)}</span>
          <span className="clean-stat-sub">Opening + Stock in</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Consumed / Used (-)</span>
          <span className="clean-stat-val">{totalUsed.toFixed(2)}</span>
          <span className="clean-stat-sub">POS sales &amp; deductions</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Closing Stock</span>
          <span className="clean-stat-val">{totalClosing.toFixed(2)}</span>
          <span className="clean-stat-sub">Remaining balance</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Opening Stock</th>
              <th style={{ textAlign: 'right' }}>Stock In (+)</th>
              <th style={{ textAlign: 'right' }}>Available</th>
              <th style={{ textAlign: 'right' }}>Used (-)</th>
              <th style={{ textAlign: 'right' }}>Closing Stock</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {ledger.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="sa-empty">
                  No inventory items tracked yet for this branch.
                </td>
              </tr>
            ) : (
              ledger.items.map(item => {
                const itemAvailable = item.opening_stock + item.stock_in
                const itemUsed = item.stock_consumed + item.wastage
                const isLow = item.expected_closing <= item.low_stock_threshold

                return (
                  <tr key={item.inventory_item_id}>
                    {/* Item Name */}
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>
                      {item.name}
                    </td>

                    {/* Unit */}
                    <td style={{ color: '#64748b' }}>
                      {item.unit}
                    </td>

                    {/* Opening Stock */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#334155' }}>
                      {item.opening_stock.toFixed(2)}
                    </td>

                    {/* Stock In */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: item.stock_in > 0 ? '#0f172a' : '#94a3b8' }}>
                      {item.stock_in > 0 ? `+${item.stock_in.toFixed(2)}` : '0.00'}
                    </td>

                    {/* Available */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                      {itemAvailable.toFixed(2)}
                    </td>

                    {/* Used */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: itemUsed > 0 ? '#475569' : '#94a3b8' }}>
                      {itemUsed > 0 ? `-${itemUsed.toFixed(2)}` : '0.00'}
                    </td>

                    {/* Closing */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {item.expected_closing.toFixed(2)}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      {isLow ? (
                        <span className="badge badge-amber">
                          Low Stock
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
