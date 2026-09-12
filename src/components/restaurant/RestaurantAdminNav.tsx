'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Restaurant } from '@/types/database'

const OPERATIONAL_ITEMS = [
  { href: '/staff/pos',             label: 'POS Terminal',      icon: '🖥️', badge: 'Billing' },
  { href: '/staff/kitchen',         label: 'Kitchen (KOT)',     icon: '👨‍🍳', badge: 'Live' },
]

const MANAGEMENT_ITEMS = [
  { href: '/restaurant/dashboard',        label: 'Dashboard',        icon: '📊' },
  { href: '/restaurant/branches',         label: 'Branches',         icon: '🏪' },
  { href: '/restaurant/menu',             label: 'Menu & Recipes',   icon: '📝' },
  { href: '/restaurant/inventory',        label: 'Inventory',        icon: '📦' },
  { href: '/restaurant/inventory/audit',  label: 'Stock Audit (EOD)', icon: '📋' },
  { href: '/restaurant/users',            label: 'Users & Staff',    icon: '👥' },
  { href: '/restaurant/roles',            label: 'Roles',            icon: '🔐' },
  { href: '/restaurant/reports',          label: 'Sales Reports',    icon: '📈' },
  { href: '/restaurant/reports/collection', label: 'Collection Report', icon: '🧾' },
  { href: '/restaurant/settings',         label: 'Settings',         icon: '⚙️' },
]

interface Props {
  profile: Profile
  restaurant: Restaurant
}

export default function RestaurantAdminNav({ profile, restaurant }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="ra-nav">
      <div className="ra-nav-brand">
        <div className="ra-nav-restaurant-avatar">{restaurant.name.charAt(0)}</div>
        <div>
          <div className="ra-nav-restaurant-name">{restaurant.name}</div>
          <div className="ra-nav-subtitle">Restaurant Admin</div>
        </div>
      </div>

      <div className="ra-nav-items">
        {/* Terminal Screens Section */}
        <div style={{ padding: '0 0.5rem 0.4rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b45309', fontWeight: 700 }}>
          Terminal Screens
        </div>
        {OPERATIONAL_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`ra-nav-item ${pathname === item.href ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            style={{
              background: pathname === item.href ? '#fef3c7' : '#fefce8',
              border: '1px solid #fde68a',
              color: '#b45309',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            <span className="ra-nav-icon">{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', fontWeight: 700 }}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        <div style={{ height: '0.75rem' }} />

        {/* Management Section */}
        <div style={{ padding: '0 0.5rem 0.4rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>
          Management
        </div>
        {MANAGEMENT_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`ra-nav-item ${pathname === item.href ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
          >
            <span className="ra-nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="ra-nav-footer">
        <div className="ra-nav-profile">
          <div className="ra-nav-avatar">{profile.name.charAt(0)}</div>
          <div>
            <div className="ra-nav-profile-name">{profile.name}</div>
            <div className="ra-nav-profile-role">Restaurant Admin</div>
          </div>
        </div>
        <button className="ra-nav-logout" onClick={handleLogout} id="logoutBtn">Sign out</button>
      </div>

      <style jsx>{`
        .ra-nav {
          width: 240px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 1rem 0.75rem;
          font-family: 'Inter', sans-serif;
          overflow-y: auto;
          box-shadow: 1px 0 3px rgba(0, 0, 0, 0.02);
        }
        .ra-nav-brand { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem 1.25rem; }
        .ra-nav-restaurant-avatar {
          width: 38px; height: 38px; border-radius: 0.6rem;
          background: linear-gradient(135deg, #f59e0b, #ea580c);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.1rem; color: #fff;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
        }
        .ra-nav-restaurant-name { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 0.95rem; color: #0f172a; line-height: 1.2; }
        .ra-nav-subtitle { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.1rem; font-weight: 500; }
        .ra-nav-items { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; overflow-y: auto; }
        .ra-nav-item {
          display: flex; align-items: center; gap: 0.65rem;
          padding: 0.55rem 0.75rem; border-radius: 0.5rem;
          color: #475569; font-size: 0.85rem; text-decoration: none;
          font-weight: 500;
          transition: all 0.15s;
        }
        .ra-nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .ra-nav-item.active { background: #fef3c7; color: #b45309; font-weight: 700; border-left: 3px solid #f59e0b; }
        .ra-nav-icon { font-size: 1rem; }
        .ra-nav-footer { border-top: 1px solid #e2e8f0; padding-top: 0.75rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .ra-nav-profile { display: flex; align-items: center; gap: 0.65rem; padding: 0.35rem; }
        .ra-nav-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #ea580c); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; color: #fff; flex-shrink: 0; }
        .ra-nav-profile-name { font-size: 0.85rem; font-weight: 600; color: #0f172a; }
        .ra-nav-profile-role { font-size: 0.7rem; color: #64748b; }
        .ra-nav-logout { width: 100%; padding: 0.45rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; color: #dc2626; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.15s; }
        .ra-nav-logout:hover { background: #fee2e2; color: #b91c1c; }
      `}</style>
    </nav>
  )
}
