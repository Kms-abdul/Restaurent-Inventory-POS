import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Restaurants — Super Admin' }

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('restaurants')
    .select(`
      id, name, slug, city, phone, is_active, created_at,
      branches (id)
    `)
    .order('created_at', { ascending: false })

  if (status === 'active')   query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)
  if (q)                     query = query.ilike('name', `%${q}%`)

  const { data: rawRestaurants } = await query
  const restaurants = rawRestaurants ?? []

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Restaurants</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage all restaurants on the platform
          </p>
        </div>
        <Link href="/super-admin/restaurants/new" className="btn-primary" id="newRestaurantBtn">
          + New Restaurant
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <form method="GET" style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Search restaurants..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.6rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.65rem',
              color: '#0f172a',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            style={{
              padding: '0.6rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.65rem',
              color: '#0f172a',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className="btn-secondary">Filter</button>
          {(q || status) && (
            <Link href="/super-admin/restaurants" className="btn-secondary" style={{ alignSelf: 'center', fontSize: '0.85rem' }}>
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="sa-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Slug</th>
                <th>City</th>
                <th>Branches</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {restaurants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="sa-empty">
                    No restaurants found.{' '}
                    <Link href="/super-admin/restaurants/new">Create the first one →</Link>
                  </td>
                </tr>
              ) : (
                restaurants.map((r: any) => (
                  <tr key={r.id}>
                    <td className="sa-td-name">
                      <span className="sa-avatar">{r.name.charAt(0).toUpperCase()}</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.name}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{r.slug}</td>
                    <td style={{ color: '#334155' }}>{r.city ?? '—'}</td>
                    <td>
                      <span className="badge badge-blue">{r.branches?.length ?? 0} branches</span>
                    </td>
                    <td style={{ color: '#475569' }}>{r.phone ?? '—'}</td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge-green' : 'badge-red'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <Link href={`/super-admin/restaurants/${r.id}`} className="link-action">
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b' }}>
          {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} total
        </div>
      </div>
    </div>
  )
}
