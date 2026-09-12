import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import StockAuditForm from '@/components/inventory/StockAuditForm'
import { getDailyInventoryLedger } from '@/app/actions/inventory-daily'

export const metadata = { title: 'Daily Stock Audit & Variance Ledger' }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Link href="/restaurant/inventory" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              ← Back to Inventory
            </Link>
          </div>
          <h1 style={{ color: '#0f172a' }}>Day-wise Stock Audit &amp; Daily Ledger</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Daily opening &amp; closing stock reconciliation. Today&apos;s physical closing count automatically sets tomorrow&apos;s opening stock.
          </p>
        </div>

        {/* Date & Branch Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Branch Selector */}
          {branchList.length > 1 && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Branch</label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {branchList.map(b => (
                  <Link
                    key={b.id}
                    href={`/restaurant/inventory/audit?branch=${b.id}&date=${selectedDate}`}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      color: activeBranch.id === b.id ? '#ffffff' : '#334155',
                      background: activeBranch.id === b.id ? '#2563eb' : '#ffffff',
                      border: activeBranch.id === b.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    }}
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Business Date Picker */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Business Date</label>
            <form method="GET" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: 0 }}>
              <input type="hidden" name="branch" value={activeBranch.id} />
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              />
              <button
                type="submit"
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
              >
                Go
              </button>

              {/* Quick Date Pills */}
              <Link
                href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${todayStr}`}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: selectedDate === todayStr ? '#eff6ff' : '#f8fafc',
                  border: selectedDate === todayStr ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                  color: selectedDate === todayStr ? '#1d4ed8' : '#64748b',
                }}
              >
                Today
              </Link>
              <Link
                href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${yesterdayStr}`}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: selectedDate === yesterdayStr ? '#eff6ff' : '#f8fafc',
                  border: selectedDate === yesterdayStr ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                  color: selectedDate === yesterdayStr ? '#1d4ed8' : '#64748b',
                }}
              >
                Yesterday
              </Link>
            </form>
          </div>
        </div>
      </div>

      {/* KPI Cards for Selected Date */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>📦 Items Tracked</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{ledger.total_items}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Active raw ingredients</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>📥 Stock In (Added Today)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: ledger.total_stock_in > 0 ? '#16a34a' : '#0f172a' }}>
            +{ledger.total_stock_in}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Purchases &amp; inward transfers</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>🍳 Consumed (POS Sales)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: ledger.total_consumed > 0 ? '#d97706' : '#0f172a' }}>
            -{ledger.total_consumed}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Recipe recipe deductions</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>⚖️ Discrepancies / Variance</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: ledger.discrepancies_count > 0 ? '#dc2626' : '#16a34a' }}>
            {ledger.discrepancies_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: ledger.discrepancies_count > 0 ? '#dc2626' : '#16a34a', marginTop: '0.2rem', fontWeight: 600 }}>
            {ledger.discrepancies_count > 0 ? '⚠️ Variances require review' : '✓ All items matched'}
          </div>
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
        <div className="ra-section" style={{ marginTop: '2.5rem', padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Past Daily EOD Audits &amp; Variance History</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Recent physical count reconciliation records for {activeBranch.name}</p>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Audit Date</th>
                  <th>Audit Status</th>
                  <th>Discrepancy Summary</th>
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
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        <Link
                          href={`/restaurant/inventory/audit?branch=${activeBranch.id}&date=${auditDateStr}`}
                          style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}
                        >
                          📅 {new Date(sc.counted_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {new Date(sc.counted_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            background: sc.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                            color: sc.status === 'confirmed' ? '#166534' : '#92400e',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {sc.status === 'confirmed' ? '✓ Confirmed' : 'Draft'}
                        </span>
                      </td>
                      <td>
                        {itemsWithVariance.length === 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Zero Discrepancies</span>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: 700 }}>
                            ⚠️ {itemsWithVariance.length} item{itemsWithVariance.length !== 1 ? 's' : ''} variance
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                          {itemsWithVariance.map((vi: any) => (
                            <span key={vi.id} style={{ color: '#334155' }}>
                              • {vi.inventory_items?.name}: <strong style={{ color: Number(vi.variance_qty) < 0 ? '#dc2626' : '#2563eb' }}>{Number(vi.variance_qty) > 0 ? `+${vi.variance_qty}` : vi.variance_qty} {vi.inventory_items?.unit}</strong> ({vi.adjustment_reason})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
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
