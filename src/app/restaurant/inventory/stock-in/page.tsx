import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { stockInAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Stock In' }

export default async function StockInPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>
}) {
  const { item: preselectedItem } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch inventory items
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, unit')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name')

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name')

  const itemList = items ?? []
  const branchList = branches ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '640px' }}>
      <div className="ra-page-header">
        <div>
          <div style={{ marginBottom: '0.35rem' }}>
            <Link href="/restaurant/inventory" className="btn-ghost-sm">
              ← Back to Inventory
            </Link>
          </div>
          <h1>Record Stock In</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Log incoming supplier deliveries and inventory additions
          </p>
        </div>
      </div>

      <form
        action={stockInAction}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Item *</label>
          <select
            name="inventory_item_id"
            required
            defaultValue={preselectedItem ?? itemList[0]?.id ?? ''}
            style={{
              padding: '0.6rem 0.75rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#0f172a',
              fontSize: '0.875rem',
            }}
          >
            {itemList.map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Receiving Branch *</label>
            <select
              name="branch_id"
              required
              defaultValue={branchList[0]?.id ?? ''}
              style={{
                padding: '0.6rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '0.875rem',
              }}
            >
              {branchList.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Quantity Added *</label>
            <input
              name="quantity"
              type="number"
              step="0.01"
              required
              placeholder="e.g. 25"
              style={{
                padding: '0.6rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Measurement Unit</label>
            <select
              name="unit"
              defaultValue="kg"
              style={{
                padding: '0.6rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '0.875rem',
              }}
            >
              <option value="kg">kg (Kilograms)</option>
              <option value="gm">gm (Grams)</option>
              <option value="liters">liters (Liters)</option>
              <option value="quantity">quantity (Units)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Date *</label>
            <input
              name="transaction_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              style={{
                padding: '0.6rem 0.75rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Supplier Name</label>
          <input
            name="supplier"
            type="text"
            placeholder="e.g. Metro Wholesale, Local Vendor"
            style={{
              padding: '0.6rem 0.75rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#0f172a',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Notes / Invoice Ref</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Invoice number or notes"
            style={{
              padding: '0.6rem 0.75rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#0f172a',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Link href="/restaurant/inventory" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Record Stock In</button>
        </div>
      </form>
    </div>
  )
}
