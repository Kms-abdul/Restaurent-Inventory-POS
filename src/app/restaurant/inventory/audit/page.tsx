import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import StockAuditForm from '@/components/inventory/StockAuditForm'
import { getDailyInventoryLedger } from '@/app/actions/inventory-daily'

export const metadata = { title: 'Daily Stock Audit' }

export default async function StockAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string }>
}) {
  const { branch: requestedBranchId, date: requestedDate } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // 1. Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const branchList = branches ?? []
  if (branchList.length === 0) {
    return (
      <div className="ra-page">
        <h1 style={{ color: '#0f172a' }}>Daily Stock Audit</h1>
        <p style={{ color: '#64748b', marginTop: '1rem' }}>No branches configured yet.</p>
      </div>
    )
  }

  const activeBranch = requestedBranchId
    ? branchList.find(b => b.id === requestedBranchId) ?? branchList[0]
    : branchList[0]

  // 2. Determine selected business date (default to today)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayDate = new Date(Date.now() - 86400000)
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10)
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayStr

  // 3. Fetch Day-wise Inventory Ledger
  const ledger = await getDailyInventoryLedger(activeBranch.id, selectedDate)

  // 4. Fetch recent stock audit history for this branch
  const { data: recentCounts } = await supabase
    .from('stock_counts')
    .select(`
      id, counted_at, notes, status,
      stock_count_items (
        id, inventory_item_id, expected_qty, actual_qty, variance_qty, adjustment_reason, notes,
        inventory_items ( name, unit )
      )
    `)
    .eq('branch_id', activeBranch.id)
    .order('counted_at', { ascending: false })
    .limit(10)

  return (
    <div className="ra-page">
      {/* Header */}
      <div className="ra-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <Link href="/restaurant/inventory" className="btn-ghost-sm">
              ← Back to Inventory
            </Link>
            <Link href={`/restaurant/inventory/daily?branch=${activeBranch.id}&date=${selectedDate}`} className="btn-ghost-sm">
              View Daily Stock Report →
            </Link>
          </div>
          <h1>EOD Stock Audit &amp; Daily Ledger</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Closing count reconciliation for <strong>{activeBranch.name}</strong> on <strong>{selectedDate}</strong>
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
                  href={`/restaurant/inventory/audit?branch=${b.id}&date=${selectedDate}`}
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
              href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${todayStr}`}
              className={`clean-seg-item ${selectedDate === todayStr ? 'active' : ''}`}
            >
              Today
            </Link>
            <Link
              href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${yesterdayStr}`}
              className={`clean-seg-item ${selectedDate === yesterdayStr ? 'active' : ''}`}
            >
              Yesterday
            </Link>
          </div>

          {/* Business Date Picker */}
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="clean-stat-grid">
        <div className="clean-stat-card">
          <span className="clean-stat-label">Items Tracked</span>
          <span className="clean-stat-val">{ledger.total_items}</span>
          <span className="clean-stat-sub">Active inventory items</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Stock Added (+)</span>
          <span className="clean-stat-val">{ledger.total_stock_in.toFixed(2)}</span>
          <span className="clean-stat-sub">Inward deliveries today</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Consumed (-)</span>
          <span className="clean-stat-val">{ledger.total_consumed.toFixed(2)}</span>
          <span className="clean-stat-sub">POS sales &amp; deductions</span>
        </div>

        <div className="clean-stat-card">
          <span className="clean-stat-label">Variances</span>
          <span className="clean-stat-val">{ledger.discrepancies_count}</span>
          <span className="clean-stat-sub">
            {ledger.discrepancies_count > 0 ? 'Items require review' : 'All counts matched'}
          </span>
        </div>
      </div>

      {/* Main Stock Audit Form */}
      <StockAuditForm
        branchId={activeBranch.id}
        branchName={activeBranch.name}
        date={selectedDate}
        items={ledger.items}
        hasEodAudit={ledger.has_eod_audit}
        auditNotes={ledger.audit_notes}
      />

      {/* Past Audits History */}
      {(recentCounts ?? []).length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Past EOD Audits &amp; History</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Recent physical reconciliation logs for {activeBranch.name}</p>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Audit Date</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th>Variances Logged</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {(recentCounts ?? []).map((sc: any) => {
                  const auditDateStr = new Date(sc.counted_at).toISOString().slice(0, 10)
                  const itemsWithVariance = (sc.stock_count_items ?? []).filter((item: any) => Math.abs(Number(item.variance_qty)) > 0.001)
                  return (
                    <tr key={sc.id}>
                      <td>
                        <Link
                          href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${auditDateStr}`}
                          style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
                        >
                          {new Date(sc.counted_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {new Date(sc.counted_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${sc.status === 'confirmed' ? 'badge-neutral' : 'badge-amber'}`}>
                          {sc.status === 'confirmed' ? 'Confirmed' : 'Draft'}
                        </span>
                      </td>
                      <td>
                        {itemsWithVariance.length === 0 ? (
                          <span style={{ color: '#16a34a', fontSize: '0.825rem', fontWeight: 600 }}>Zero Discrepancies</span>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '0.825rem', fontWeight: 600 }}>
                            {itemsWithVariance.length} variance{itemsWithVariance.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.8rem' }}>
                          {itemsWithVariance.map((vi: any) => (
                            <span key={vi.id} style={{ color: '#475569' }}>
                              {vi.inventory_items?.name}: <strong style={{ color: '#0f172a' }}>{Number(vi.variance_qty) > 0 ? `+${vi.variance_qty}` : vi.variance_qty} {vi.inventory_items?.unit}</strong> ({vi.adjustment_reason})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.825rem' }}>
                        {sc.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
