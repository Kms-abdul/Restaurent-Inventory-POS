import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Branches' }

export default async function BranchesPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, city, phone, address, is_active, created_at')
    .eq('restaurant_id', ctx.restaurantId)
    .order('created_at', { ascending: true })

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Branches</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Manage your restaurant locations</p>
        </div>
        <Link href="/restaurant/branches/new" className="btn-primary">+ Add Branch</Link>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {(branches ?? []).map((b: any) => (
          <div key={b.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{b.name}</h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{b.city ?? '—'}</p>
              </div>
              <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>{b.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            {b.address && <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>📍 {b.address}</p>}
            {b.phone   && <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem'  }}>📞 {b.phone}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <Link href={`/restaurant/branches/${b.id}`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>✏️ Edit</Link>
              <Link href={`/restaurant/branches/${b.id}/staff`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>👥 Staff</Link>
              <Link href={`/restaurant/branches/${b.id}/printers`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>🖨️ Printers</Link>
            </div>
          </div>
        ))}

        <Link href="/restaurant/branches/new" style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textDecoration: 'none', color: '#4f46e5', minHeight: '160px', transition: 'all 0.2s' }}>
          <span style={{ fontSize: '2rem' }}>+</span>
          <span style={{ fontWeight: 600 }}>Add New Branch</span>
        </Link>
      </div>
    </div>
  )
}
