import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function RestaurantDashboard() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Load branches for this restaurant
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, city, is_active')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name')

  // Load today's orders across all branches
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, total_amount, status, fulfillment, branch_id')
    .eq('restaurant_id', ctx.restaurantId)
    .gte('created_at', today.toISOString())

  const orders = todayOrders ?? []
  const totalRevenue = orders
    .filter(o => o.status === 'settled')
    .reduce((sum, o) => sum + o.total_amount, 0)
  const totalOrders = orders.length
  const pendingKitchen = orders.filter(o => ['pending', 'cooking'].includes(o.fulfillment)).length

  // Low stock count
  const { count: lowStockCount } = await supabase
    .from('inventory_current_stock')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_low_stock', true)

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <p className="ra-greeting">Good {getTimeOfDay()} 👋</p>
          <h1>{ctx.restaurant?.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            href="/staff/pos"
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
            }}
          >
            🖥️ Open POS Terminal (Take Orders)
          </Link>
          <Link
            href="/staff/kitchen"
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
          >
            👨‍🍳 Kitchen KOT
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-revenue">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <div className="kpi-label">Today&apos;s Revenue</div>
            <div className="kpi-value">₹{(totalRevenue / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
          </div>
        </div>
        <div className="kpi-card kpi-orders">
          <div className="kpi-icon">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Total Orders</div>
            <div className="kpi-value">{totalOrders}</div>
          </div>
        </div>
        <div className="kpi-card kpi-kitchen">
          <div className="kpi-icon">👨‍🍳</div>
          <div className="kpi-content">
            <div className="kpi-label">Pending Kitchen (KOT)</div>
            <div className="kpi-value">{pendingKitchen}</div>
          </div>
        </div>
        <div className={`kpi-card ${(lowStockCount ?? 0) > 0 ? 'kpi-warning' : 'kpi-ok'}`}>
          <div className="kpi-icon">{(lowStockCount ?? 0) > 0 ? '⚠️' : '✅'}</div>
          <div className="kpi-content">
            <div className="kpi-label">Low Stock Items</div>
            <div className="kpi-value">{lowStockCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Primary Terminal Launchpad */}
      <div className="ra-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.4rem', color: '#0f172a', fontWeight: 800 }}>
          ⚡ Front of House &amp; Operations Launchpad
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 500 }}>
          Launch cashier terminals, live kitchen display, physical count audits, and daily cash handover reports.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <Link
            href="/staff/pos"
            style={{
              background: '#fefce8',
              border: '1.5px solid #fde68a',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              boxShadow: '0 2px 5px rgba(245, 158, 11, 0.08)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖥️</div>
            <strong style={{ color: '#b45309', fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem', fontWeight: 800 }}>
              POS Terminal
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Take orders, customer billing, and settle payments.
            </span>
          </Link>

          <Link
            href="/staff/kitchen"
            style={{
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              boxShadow: '0 2px 5px rgba(59, 130, 246, 0.08)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👨‍🍳</div>
            <strong style={{ color: '#1d4ed8', fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem', fontWeight: 800 }}>
              Kitchen KOT
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Live chef prep queue and fulfillment ticketing.
            </span>
          </Link>

          <Link
            href="/restaurant/inventory/audit"
            style={{
              background: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              boxShadow: '0 2px 5px rgba(34, 197, 94, 0.08)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <strong style={{ color: '#15803d', fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem', fontWeight: 800 }}>
              EOD Stock Audit
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Enter shelf count, check variance &amp; wastage loss.
            </span>
          </Link>

          <Link
            href="/restaurant/reports/collection"
            style={{
              background: '#fdf2f8',
              border: '1.5px solid #fbcfe8',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              boxShadow: '0 2px 5px rgba(236, 72, 153, 0.08)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾</div>
            <strong style={{ color: '#be185d', fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem', fontWeight: 800 }}>
              Collection Report
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Cashier drawer handover, cash vs UPI totals.
            </span>
          </Link>
        </div>
      </div>

      {/* Branches Overview */}
      <div className="ra-section">
        <div className="ra-section-header">
          <h2>Branches</h2>
          <Link href="/restaurant/branches" className="btn-ghost-sm" id="manageBranchesBtn">Manage →</Link>
        </div>
        <div className="branch-cards">
          {(branches ?? []).map(b => (
            <div className="branch-card" key={b.id}>
              <div className="branch-card-name">{b.name}</div>
              {b.city && <div className="branch-card-city">{b.city}</div>}
              <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>
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
        <h2>Management &amp; Setup</h2>
        <div className="quick-actions">
          <Link href="/restaurant/menu" className="qa-btn" id="qaMenuBtn">📝 Menu &amp; Recipes</Link>
          <Link href="/restaurant/inventory" className="qa-btn" id="qaInventoryBtn">📦 Inventory Stock</Link>
          <Link href="/restaurant/users" className="qa-btn" id="qaUsersBtn">👥 Users &amp; Cashiers</Link>
          <Link href="/restaurant/roles" className="qa-btn" id="qaRolesBtn">🔐 Roles &amp; Permissions</Link>
          <Link href="/restaurant/reports" className="qa-btn" id="qaReportsBtn">📈 Sales Reports</Link>
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
