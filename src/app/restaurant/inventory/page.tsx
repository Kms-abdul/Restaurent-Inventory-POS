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
          <h1>Inventory Items</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            {allItems.length} items tracked · {lowStock.length > 0 ? `${lowStock.length} items low stock` : 'All items in stock'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/restaurant/inventory/daily" className="btn-secondary">
            Daily Stock Report
          </Link>
          <Link href="/restaurant/inventory/audit" className="btn-secondary">
            EOD Stock Audit
          </Link>
          <Link href="/restaurant/inventory/stock-in" className="btn-secondary">
            Record Stock In
          </Link>
          <Link href="/restaurant/inventory/new" className="btn-primary">
            + New Item
          </Link>
        </div>
      </div>

      {/* Low Stock Notice */}
      {lowStock.length > 0 && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span className="badge badge-amber">Low Stock</span>
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
            {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} below reorder threshold: {lowStock.slice(0, 4).map((i: any) => i.name).join(', ')}{lowStock.length > 4 ? ` and ${lowStock.length - 4} more` : ''}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Branch</th>
              <th style={{ textAlign: 'right' }}>Current Stock</th>
              <th style={{ textAlign: 'right' }}>Reorder Level</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
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
                  <tr key={`${item.inventory_item_id}-${item.branch_id ?? idx}`}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                    <td style={{ color: '#64748b' }}>{item.unit}</td>
                    <td style={{ color: '#475569', fontSize: '0.85rem' }}>{branch?.name ?? 'All Branches'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                      {Number(item.current_qty ?? 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>
                      {Number(item.low_stock_threshold ?? 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.is_low_stock ? 'badge-amber' : 'badge-neutral'}`}>
                        {item.is_low_stock ? 'Low' : 'OK'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <Link href={`/restaurant/inventory/stock-in?item=${item.inventory_item_id}`} className="btn-ghost-sm">
                          + Stock In
                        </Link>
                        <Link href={`/restaurant/inventory/${item.inventory_item_id}/edit`} className="btn-ghost-sm">
                          Edit
                        </Link>
                      </div>
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
