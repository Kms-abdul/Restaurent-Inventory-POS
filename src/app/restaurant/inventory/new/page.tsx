import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { createInventoryItemAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'New Inventory Item' }

export default async function NewInventoryItemPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const branchList = branches ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '650px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/inventory" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Inventory
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Add Inventory Item</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Track raw ingredients, packaged stock, or packaging supplies
          </p>
        </div>
      </div>

      <form action={createInventoryItemAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Item Name *</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Basmati Rice, Chicken Breast, Cooking Oil, Takeaway Box"
            style={{
              padding: '0.75rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: '#0f172a',
              fontSize: '0.95rem',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Measurement Unit *</label>
            <select
              name="unit"
              required
              defaultValue="kg"
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              <option value="kg">kg (Kilograms)</option>
              <option value="g">g (Grams)</option>
              <option value="l">l (Liters)</option>
              <option value="ml">ml (Milliliters)</option>
              <option value="pcs">pcs (Pieces / Units)</option>
              <option value="pack">pack (Packets)</option>
              <option value="box">box (Boxes)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Low Stock Warning Threshold</label>
            <input
              name="low_stock_threshold"
              type="number"
              step="0.1"
              defaultValue={5}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Supplier specifications or storage guidelines"
            style={{
              padding: '0.75rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: '#0f172a',
              fontSize: '0.95rem',
            }}
          />
        </div>

        {branchList.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Opening Stock (Optional)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Branch</label>
                <select
                  name="branch_id"
                  defaultValue={branchList[0]?.id}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    fontSize: '0.95rem',
                  }}
                >
                  {branchList.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Initial Quantity</label>
                <input
                  name="opening_qty"
                  type="number"
                  step="0.01"
                  defaultValue={0}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Opening Stock Date</label>
                <input
                  name="opening_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    fontSize: '0.95rem',
                  }}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Setting the date records this opening balance for that business day, correctly establishing tomorrow&apos;s opening stock.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/restaurant/inventory" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Add Item</button>
        </div>
      </form>
    </div>
  )
}
