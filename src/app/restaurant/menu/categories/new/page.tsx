import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext } from '@/utils/supabase/server'
import { createMenuCategoryAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'New Menu Category' }

export default async function NewCategoryPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  return (
    <div className="ra-page" style={{ maxWidth: '600px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Add Menu Category</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Group menu items into sections like Starters, Main Course, Drinks
          </p>
        </div>
      </div>

      <form action={createMenuCategoryAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Category Name *</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Biryani, Appetizers, Beverages, Desserts"
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
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Optional subtitle for menu displays"
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
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Display Sort Order</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={1}
            min={0}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/restaurant/menu" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create Category</button>
        </div>
      </form>
    </div>
  )
}
