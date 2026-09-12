import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { updateMenuCategoryAction, deleteMenuCategoryAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Edit Category' }

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  const { data: category } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!category) notFound()

  return (
    <div className="ra-page" style={{ maxWidth: '600px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Category: {category.name}</h1>
        </div>
      </div>

      <form action={updateMenuCategoryAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="category_id" value={category.id} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Category Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={category.name}
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
            defaultValue={category.description ?? ''}
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Sort Order</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={category.sort_order}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Status</label>
            <select
              name="is_active"
              defaultValue={category.is_active ? 'true' : 'false'}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              <option value="true">Active (Visible in POS)</option>
              <option value="false">Hidden</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            formAction={async () => {
              'use server'
              await deleteMenuCategoryAction(category.id)
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
            Delete Category
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
