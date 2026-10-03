import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function RestaurantDashboard() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Load branches, today's orders, and low stock count concurrently in parallel
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [branchesRes, ordersRes, lowStockRes] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, city, is_active')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('orders')
      .select('id, total_amount, status, fulfillment, branch_id')
      .eq('restaurant_id', ctx.restaurantId)
      .gte('created_at', today.toISOString()),
    supabase
      .from('inventory_current_stock')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', ctx.restaurantId)
      .eq('is_low_stock', true),
  ])

  const branches = branchesRes.data
  const todayOrders = ordersRes.data ?? []
  const lowStockCount = lowStockRes.count

  const totalRevenue = todayOrders
    .filter(o => o.status === 'settled')
    .reduce((sum, o) => sum + o.total_amount, 0)
  const totalOrders = todayOrders.length
  const pendingKitchen = todayOrders.filter(o => ['pending', 'cooking'].includes(o.fulfillment)).length

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <p className="ra-greeting">Good {getTimeOfDay()}</p>
          <h1>{ctx.restaurant?.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link href="/staff/pos" className="btn-primary">
            Open POS Terminal
          </Link>
          <Link href="/staff/kitchen" className="btn-secondary">
            Kitchen KOT
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="clean-stat-grid">
        <div className="clean-stat-card">
          <span className="clean-stat-label">Today&apos;s Revenue</span>
          <span className="clean-stat-val">₹{(totalRevenue / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
          <span className="clean-stat-sub">Settled sales</span>
        </div>
        <div className="clean-stat-card">
          <span className="clean-stat-label">Total Orders</span>
          <span className="clean-stat-val">{totalOrders}</span>
          <span className="clean-stat-sub">Placed today</span>
        </div>
        <div className="clean-stat-card">
          <span className="clean-stat-label">Kitchen Queue</span>
          <span className="clean-stat-val">{pendingKitchen}</span>
          <span className="clean-stat-sub">Pending / Cooking KOTs</span>
        </div>
        <div className="clean-stat-card">
          <span className="clean-stat-label">Low Stock</span>
          <span className="clean-stat-val">{lowStockCount ?? 0}</span>
          <span className="clean-stat-sub">{(lowStockCount ?? 0) > 0 ? 'Items below reorder level' : 'Stock levels normal'}</span>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="ra-section">
        <div className="ra-section-header">
          <h2>Operations &amp; Terminals</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
          <Link
            href="/staff/pos"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.12s',
            }}
          >
            <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              POS Terminal
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Take orders, customer billing, and settle payments.
            </span>
          </Link>

          <Link
            href="/staff/kitchen"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.12s',
            }}
          >
            <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              Kitchen KOT
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Live chef prep queue and fulfillment ticketing.
            </span>
          </Link>

          <Link
            href="/restaurant/inventory/daily"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.12s',
            }}
          >
            <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              Daily Stock Report
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Opening, purchases, consumption, and closing ledger.
            </span>
          </Link>

          <Link
            href="/restaurant/inventory/audit"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.12s',
            }}
          >
            <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              EOD Stock Audit
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Physical closing shelf count, variance, and loss audit.
            </span>
          </Link>
        </div>
      </div>

      {/* Branches Overview */}
      <div className="ra-section">
        <div className="ra-section-header">
          <h2>Branches</h2>
          <Link href="/restaurant/branches" className="btn-ghost-sm" id="manageBranchesBtn">Manage Branches →</Link>
        </div>
        <div className="branch-cards">
          {(branches ?? []).map(b => (
            <div className="branch-card" key={b.id}>
              <div className="branch-card-name">{b.name}</div>
              {b.city && <div className="branch-card-city">{b.city}</div>}
              <span className={`badge ${b.is_active ? 'badge-neutral' : 'badge-amber'}`}>
                {b.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
          <Link href="/restaurant/branches/new" className="branch-card branch-card-add" id="addBranchBtn">
            <div className="branch-card-add-icon">+</div>
            <div>Add Branch</div>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="ra-section">
        <div className="ra-section-header">
          <h2>Management &amp; Setup</h2>
        </div>
        <div className="quick-actions">
          <Link href="/restaurant/menu" className="qa-btn" id="qaMenuBtn">Menu &amp; Recipes</Link>
          <Link href="/restaurant/inventory" className="qa-btn" id="qaInventoryBtn">Inventory Stock</Link>
          <Link href="/restaurant/users" className="qa-btn" id="qaUsersBtn">Users &amp; Staff</Link>
          <Link href="/restaurant/roles" className="qa-btn" id="qaRolesBtn">Roles &amp; Permissions</Link>
          <Link href="/restaurant/reports" className="qa-btn" id="qaReportsBtn">Sales Reports</Link>
        </div>
      </div>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
