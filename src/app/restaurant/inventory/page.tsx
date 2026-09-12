import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Inventory' }

export default async function InventoryPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch all inventory items with current stock for all branches
  const { data: items } = await supabase
    .from('inventory_current_stock')
    .select('*')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name', { ascending: true })

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const allItems = items ?? []
  const lowStock = allItems.filter((i: any) => i.is_low_stock)

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Inventory</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {allItems.length} items tracked · {lowStock.length > 0 ? <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ {lowStock.length} low stock</span> : <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ All stocked</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/restaurant/inventory/audit" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            📋 Daily Stock Audit &amp; EOD
          </Link>
          <Link href="/restaurant/inventory/stock-in" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            📥 Stock In
          </Link>
          <Link href="/restaurant/inventory/new" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            + New Item
          </Link>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#b45309' }}>{lowStock.length} items are running low:</strong>
            <span style={{ color: '#78350f', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
              {lowStock.slice(0, 4).map((i: any) => i.name).join(', ')}{lowStock.length > 4 ? ` and ${lowStock.length - 4} more` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="ra-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th>Branch</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="sa-empty">
                    No inventory items yet. <Link href="/restaurant/inventory/new">Add your first item →</Link>
                  </td>
                </tr>
              ) : (
                allItems.map((item: any, idx: number) => {
                  const branch = (branches ?? []).find((b: any) => b.id === item.branch_id)
                  return (
                    <tr key={`${item.inventory_item_id}-${item.branch_id ?? idx}`} style={item.is_low_stock ? { background: '#fffdf5' } : {}}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                      <td style={{ color: '#475569' }}>{item.unit}</td>
                      <td style={{ color: '#475569', fontSize: '0.85rem' }}>{branch?.name ?? 'All Branches'}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: item.is_low_stock ? '#d97706' : '#16a34a', fontSize: '1.05rem' }}>
                          {Number(item.current_qty ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{Number(item.low_stock_threshold ?? 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${item.is_low_stock ? 'badge-amber' : 'badge-green'}`}>
                          {item.is_low_stock ? '⚠️ Low' : '✓ OK'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <Link href={`/restaurant/inventory/stock-in?item=${item.inventory_item_id}`} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>+ Stock In</Link>
                        <Link href={`/restaurant/inventory/${item.inventory_item_id}/edit`} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>Edit</Link>
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
