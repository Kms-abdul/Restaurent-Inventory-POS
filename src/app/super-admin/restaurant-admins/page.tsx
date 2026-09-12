import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext } from '@/utils/supabase/server'

export const metadata = { title: 'Restaurant Admins — Super Admin' }

export default async function RestaurantAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; restaurant?: string }>
}) {
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  const { q, restaurant: restaurantFilter } = await searchParams

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all restaurant members (restaurant-level admins)
  const { data: rawMembers } = await admin
    .from('restaurant_members')
    .select(`
      id,
      user_id,
      restaurant_id,
      is_active,
      created_at,
      restaurants ( id, name, city ),
      profiles ( id, name, phone, is_active, avatar_url )
    `)
    .order('created_at', { ascending: false })

  const members = rawMembers ?? []

  // Get auth user list for emails
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authData.users.map(u => [u.id, u.email ?? '—']))
  const lastSignInMap = new Map(authData.users.map(u => [u.id, u.last_sign_in_at]))

  // Fetch restaurant list for filter dropdown
  const { data: restaurants } = await admin.from('restaurants').select('id, name').order('name')

  // Apply filters
  const filtered = members.filter((m: any) => {
    const profile    = Array.isArray(m.profiles)     ? m.profiles[0]     : m.profiles
    const restaurant = Array.isArray(m.restaurants)  ? m.restaurants[0]  : m.restaurants
    const email      = emailMap.get(m.user_id) ?? ''
    if (restaurantFilter && restaurant?.id !== restaurantFilter) return false
    if (q) {
      const ql = q.toLowerCase()
      if (!profile?.name?.toLowerCase().includes(ql) && !email.toLowerCase().includes(ql)) return false
    }
    return true
  })

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Restaurant Admins</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            View and manage all restaurant-level admin accounts
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Search by name or email..."
          style={{
            flex: 1, minWidth: '220px',
            padding: '0.6rem 1rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.65rem',
            color: '#0f172a', fontSize: '0.875rem', outline: 'none',
          }}
        />
        <select
          name="restaurant"
          defaultValue={restaurantFilter ?? ''}
          style={{
            padding: '0.6rem 1rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.65rem',
            color: '#0f172a', fontSize: '0.875rem', outline: 'none',
          }}
        >
          <option value="">All Restaurants</option>
          {(restaurants ?? []).map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
        {(q || restaurantFilter) && (
          <Link href="/super-admin/restaurant-admins" className="btn-secondary" style={{ alignSelf: 'center', fontSize: '0.85rem' }}>Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="sa-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Restaurant</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="sa-empty">No restaurant admins found.</td>
                </tr>
              ) : (
                filtered.map((m: any) => {
                  const profile    = Array.isArray(m.profiles)    ? m.profiles[0]    : m.profiles
                  const restaurant = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants
                  const email      = emailMap.get(m.user_id) ?? '—'
                  const lastLogin  = lastSignInMap.get(m.user_id)
                  const isActive   = profile?.is_active !== false && m.is_active

                  return (
                    <tr key={m.id}>
                      <td className="sa-td-name">
                        <div className="sa-avatar" style={{ background: isActive ? undefined : '#fecaca', color: isActive ? undefined : '#dc2626' }}>
                          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{profile?.name ?? 'Unknown'}</span>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.875rem' }}>{email}</td>
                      <td style={{ color: '#64748b', fontSize: '0.875rem' }}>{profile?.phone ?? '—'}</td>
                      <td>
                        <Link href={`/super-admin/restaurants/${restaurant?.id}`} className="link-action" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          🏪 {restaurant?.name ?? '—'}
                        </Link>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {lastLogin ? new Date(lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-green' : 'badge-red'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/super-admin/restaurant-admins/${m.user_id}`}
                          className="btn-secondary"
                          style={{ gap: '0.35rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                        >
                          ✏️ Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b' }}>
          {filtered.length} admin{filtered.length !== 1 ? 's' : ''} {q || restaurantFilter ? '(filtered)' : 'total'}
        </div>
      </div>
    </div>
  )
}
