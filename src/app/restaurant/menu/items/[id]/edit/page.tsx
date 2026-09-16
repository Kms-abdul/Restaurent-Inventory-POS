import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { updateMenuItemAction, deleteMenuItemAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Edit Menu Item' }

export default async function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch item
  const { data: item } = await supabase
    .from('menu_items')
    .select(`
      *,
      branch_menu_items ( branch_id, is_available )
    `)
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!item) notFound()

  // Fetch categories
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('sort_order', { ascending: true })

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name')

  const catList = categories ?? []
  const branchList = branches ?? []

  const branchOverrides = item.branch_menu_items ?? []
  const assignedBranchIds = new Set(
    branchOverrides.length > 0
      ? branchOverrides.filter((b: any) => b.is_available).map((b: any) => b.branch_id)
      : branchList.map(b => b.id) // default all if no override
  )

  return (
    <div className="ra-page" style={{ maxWidth: '650px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Item: {item.name}</h1>
        </div>

        <Link href={`/restaurant/menu/items/${item.id}/recipe`} className="btn-secondary" style={{ color: '#b45309', fontWeight: 600 }}>
          🥣 Configure Recipe Ingredients
        </Link>
      </div>

      <form action={updateMenuItemAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="item_id" value={item.id} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Item Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={item.name}
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Category *</label>
            <select
              name="category_id"
              required
              defaultValue={item.category_id}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              {catList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Price (₹) *</label>
            <input
              name="price"
              type="number"
              step="0.01"
              required
              defaultValue={(Number(item.price) / 100).toFixed(2)}
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
            defaultValue={item.description ?? ''}
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

        {/* Branch Assignment Section */}
        {branchList.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '0.3rem' }}>
              🏪 Assign to Branches (Branch Availability)
            </label>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.85rem' }}>
              Check which branches serve this item. Only checked branches will have this item on their POS terminal.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem' }}>
              {branchList.map(b => (
                <label
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    name="branch_ids"
                    value={b.id}
                    defaultChecked={assignedBranchIds.has(b.id)}
                    style={{ accentColor: '#2563eb', transform: 'scale(1.1)' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>{b.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Availability</label>
          <select
            name="is_available"
            defaultValue={item.is_available ? 'true' : 'false'}
            style={{
              padding: '0.75rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: '#0f172a',
              fontSize: '0.95rem',
            }}
          >
            <option value="true">In Stock &amp; Available</option>
            <option value="false">Temporarily Out of Stock</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="submit"
            formNoValidate
            formAction={async () => {
              'use server'
              await deleteMenuItemAction(item.id)
              redirect('/restaurant/menu')
            }}
            style={{
              padding: '0.6rem 1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Delete Item
          </button>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </div>
      </form>
    </div>
  )
}
