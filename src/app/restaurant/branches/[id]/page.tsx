import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { updateBranchAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Edit Branch' }

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('*')
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!branch) notFound()

  return (
    <div className="ra-page" style={{ maxWidth: '650px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/branches" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Branches
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Branch: {branch.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Update branch location information and operational status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/restaurant/branches/${branch.id}/staff`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>👥 Staff</Link>
          <Link href={`/restaurant/branches/${branch.id}/printers`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>🖨️ Printers</Link>
        </div>
      </div>

      <form action={updateBranchAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="branch_id" value={branch.id} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Branch Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={branch.name}
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>City</label>
            <input
              name="city"
              type="text"
              defaultValue={branch.city ?? ''}
              placeholder="e.g. Hyderabad"
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
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Phone</label>
            <input
              name="phone"
              type="text"
              defaultValue={branch.phone ?? ''}
              placeholder="+91 98765 43210"
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
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Address</label>
          <textarea
            name="address"
            rows={3}
            defaultValue={branch.address ?? ''}
            placeholder="Complete street address"
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
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Branch Status</label>
          <select
            name="is_active"
            defaultValue={branch.is_active ? 'true' : 'false'}
            style={{
              padding: '0.75rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: '#0f172a',
              fontSize: '0.95rem',
            }}
          >
            <option value="true">Active (Open for business)</option>
            <option value="false">Inactive (Suspended / Closed)</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/restaurant/branches" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  )
}
