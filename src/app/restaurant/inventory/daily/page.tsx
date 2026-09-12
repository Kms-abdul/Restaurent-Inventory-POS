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
    <div className="ra-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Navigation Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            <Link href="/restaurant/inventory" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to Inventory
            </Link>
            <span style={{ color: '#94a3b8' }}>|</span>
            <Link href="/restaurant/inventory/stock-in" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
              + Record Stock In (Purchases)
            </Link>
          </div>
          <h1 style={{ color: '#0f172a', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            Daily Stock & Purchase Report
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Day-by-day stock balance for <strong>{activeBranch.name}</strong> on <strong>{selectedDate}</strong>
          </p>
        </div>

        {/* Date & Branch Selectors */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Branch Switcher */}
          {branchList.length > 1 && (
            <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
              {branchList.map(b => (
                <Link
                  key={b.id}
                  href={`/restaurant/inventory/daily?branch=${b.id}&date=${selectedDate}`}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: activeBranch.id === b.id ? '#0f172a' : '#64748b',
                    background: activeBranch.id === b.id ? '#ffffff' : 'transparent',
                    boxShadow: activeBranch.id === b.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {b.name}
                </Link>
              ))}
            </div>
          )}

          {/* Quick Date Selectors */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <Link
              href={`/restaurant/inventory/daily?branch=${activeBranch.id}&date=${todayStr}`}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: selectedDate === todayStr ? '#2563eb' : '#ffffff',
                color: selectedDate === todayStr ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
              }}
            >
              Today
            </Link>
            <Link
              href={`/restaurant/inventory/daily?branch=${activeBranch.id}&date=${yesterdayStr}`}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: selectedDate === yesterdayStr ? '#2563eb' : '#ffffff',
                color: selectedDate === yesterdayStr ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
              }}
            >
              Yesterday
            </Link>
            <form method="GET" style={{ display: 'inline-flex', gap: '0.35rem', margin: 0 }}>
              <input type="hidden" name="branch" value={activeBranch.id} />
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.4rem',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Simple Human Math Explanation Banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
          <strong>💡 Stock Calculation Formula:</strong> Opening Stock (Yesterday EOD) + Bought Today = <strong>Total Available</strong>.
          Subtracting Today&apos;s Sales &amp; Consumption gives your <strong>Closing Stock</strong>.
        </div>
      </div>

      {/* Simple Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Yesterday EOD</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
            {totalOpening.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Carried Over Stock</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>+ Bought Today</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a', marginTop: '0.2rem' }}>
            +{totalBought.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fresh Stock Purchased</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase' }}>= Total Available</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>
            {totalAvailable.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Opening + Bought</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>- Used Today</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '0.2rem' }}>
            -{totalUsed.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sales &amp; Wastage</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #0f172a', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600, textTransform: 'uppercase' }}>= Closing Stock</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
            {totalClosing.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Remaining Stock</div>
        </div>
      </div>

      {/* Simple Human Format Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Item Name</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Unit</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right' }}>Yesterday EOD<br/><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Opening Stock)</span></th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right', color: '#16a34a' }}>+ Bought Today<br/><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Stock In)</span></th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right', color: '#2563eb' }}>= Total Available<br/><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Opening + Bought)</span></th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right', color: '#dc2626' }}>- Used Today<br/><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(POS Sales + Wastage)</span></th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right' }}>= Closing Stock<br/><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Remaining)</span></th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {ledger.items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No inventory items tracked yet.
                </td>
              </tr>
            ) : (
              ledger.items.map((item, idx) => {
                const itemAvailable = item.opening_stock + item.stock_in
                const itemUsed = item.stock_consumed + item.wastage
                const isLow = item.expected_closing <= item.low_stock_threshold

                return (
                  <tr
                    key={item.inventory_item_id}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    {/* Item Name */}
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                      {item.name}
                    </td>

                    {/* Unit */}
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      {item.unit}
                    </td>

                    {/* Yesterday EOD (Opening Stock) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                      {item.opening_stock.toFixed(2)} {item.unit}
                    </td>

                    {/* Bought Today (+ Stock In) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: item.stock_in > 0 ? '#16a34a' : '#94a3b8' }}>
                      {item.stock_in > 0 ? `+${item.stock_in.toFixed(2)}` : '0.00'} {item.unit}
                    </td>

                    {/* Total Available (Opening + Bought) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', background: '#f0f9ff' }}>
                      {itemAvailable.toFixed(2)} {item.unit}
                    </td>

                    {/* Used Today (- Sales/Wastage) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: itemUsed > 0 ? '#dc2626' : '#94a3b8' }}>
                      {itemUsed > 0 ? `-${itemUsed.toFixed(2)}` : '0.00'} {item.unit}
                    </td>

                    {/* Closing Stock (Remaining) */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: isLow ? '#d97706' : '#0f172a' }}>
                      {item.expected_closing.toFixed(2)} {item.unit}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {isLow ? (
                        <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
                          Low Stock
                        </span>
                      ) : (
                        <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
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
