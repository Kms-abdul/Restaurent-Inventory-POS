import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import type { Restaurant } from '@/types/database'

async function getStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ count: totalRestaurants }, { count: activeRestaurants }] = await Promise.all([
    supabase.from('restaurants').select('*', { count: 'exact', head: true }),
    supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])
  return { totalRestaurants: totalRestaurants ?? 0, activeRestaurants: activeRestaurants ?? 0 }
}

async function getRecentRestaurants(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, slug, city, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return (data ?? []) as Pick<Restaurant, 'id' | 'name' | 'slug' | 'city' | 'is_active' | 'created_at'>[]
}

export default async function SuperAdminDashboard() {
  const supabase = await createClient()
  const [stats, recent] = await Promise.all([
    getStats(supabase),
    getRecentRestaurants(supabase),
  ])

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h1>Platform Dashboard</h1>
        <Link href="/super-admin/restaurants/new" className="btn-primary" id="createRestaurantBtn">
          + New Restaurant
        </Link>
      </div>

      <div className="sa-stats-grid">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Total Restaurants</div>
          <div className="sa-stat-value">{stats.totalRestaurants}</div>
        </div>
        <div className="sa-stat-card sa-stat-green">
          <div className="sa-stat-label">Active</div>
          <div className="sa-stat-value">{stats.activeRestaurants}</div>
        </div>
        <div className="sa-stat-card sa-stat-orange">
          <div className="sa-stat-label">Inactive</div>
          <div className="sa-stat-value">{stats.totalRestaurants - stats.activeRestaurants}</div>
        </div>
      </div>

      <div className="sa-section">
        <div className="sa-section-header">
          <h2>Recent Restaurants</h2>
          <Link href="/super-admin/restaurants" className="link-muted">View all →</Link>
        </div>

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>City</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">
                    No restaurants yet.{' '}
                    <Link href="/super-admin/restaurants/new">Create the first one →</Link>
                  </td>
                </tr>
              ) : (
                recent.map(r => (
                  <tr key={r.id}>
                    <td className="sa-td-name">
                      <span className="sa-avatar">{r.name.charAt(0).toUpperCase()}</span>
                      {r.name}
                    </td>
                    <td>{r.city ?? '—'}</td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge-green' : 'badge-red'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link href={`/super-admin/restaurants/${r.id}`} className="link-action">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
