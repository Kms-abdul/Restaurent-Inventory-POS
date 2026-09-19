'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Profile, Restaurant } from '@/types/database'

const OPERATIONAL_ITEMS = [
  { href: '/staff/pos', label: 'POS Terminal' },
  { href: '/staff/kitchen', label: 'Kitchen (KOT)' },
]

const MANAGEMENT_ITEMS = [
  { href: '/restaurant/dashboard',          label: 'Dashboard' },
  { href: '/restaurant/branches',           label: 'Branches' },
  { href: '/restaurant/menu',               label: 'Menu & Recipes' },
  { href: '/restaurant/inventory',          label: 'Inventory' },
  { href: '/restaurant/inventory/daily',    label: 'Daily Stock Report' },
  { href: '/restaurant/inventory/audit',    label: 'Stock Audit (EOD)' },
  { href: '/restaurant/users',              label: 'Users & Staff' },
  { href: '/restaurant/roles',              label: 'Roles' },
  { href: '/restaurant/reports',            label: 'Sales Reports' },
  { href: '/restaurant/reports/collection', label: 'Collection Report' },
  { href: '/restaurant/settings',           label: 'Settings' },
]

interface Props {
  profile: Profile
  restaurant: Restaurant
}

export default function RestaurantAdminNav({ profile, restaurant }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  // Clear pending state when route resolves
  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  const handleNavClick = (href: string) => {
    if (href === pathname) return
    setPendingHref(href)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
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
        {/* Terminal Screens */}
        <div className="ra-nav-section-label">Terminal Screens</div>
        {OPERATIONAL_ITEMS.map(item => {
          const isPending = pendingHref === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={`ra-nav-item ra-nav-item-terminal ${pathname === item.href ? 'active' : ''} ${isPending ? 'nav-item-pending' : ''}`}
              id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
            </Link>
          )
        })}

        <div style={{ height: '0.25rem' }} />

        {/* Management */}
        <div className="ra-nav-section-label">Management</div>
        {MANAGEMENT_ITEMS.map(item => {
          const isPending = pendingHref === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={`ra-nav-item ${pathname === item.href ? 'active' : ''} ${isPending ? 'nav-item-pending' : ''}`}
              id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="ra-nav-footer">
        <div className="ra-nav-profile">
          <div className="ra-nav-avatar">{profile.name.charAt(0)}</div>
          <div>
            <div className="ra-nav-profile-name">{profile.name}</div>
            <div className="ra-nav-profile-role">Restaurant Admin</div>
          </div>
        </div>
        <button
          className={`ra-nav-logout ${loggingOut ? 'btn-loading' : ''}`}
          onClick={handleLogout}
          id="logoutBtn"
          disabled={loggingOut}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          {loggingOut
            ? <><span className="btn-spinner btn-spinner-dark" />Signing out…</>
            : '↩ Sign out'
          }
        </button>
      </div>

      <style jsx>{`
        .ra-nav {
          width: 228px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 1.25rem 0.75rem;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          overflow-y: auto;
        }
        .ra-nav-brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.35rem 0.5rem 1.25rem;
          flex-shrink: 0;
        }
        .ra-nav-restaurant-avatar {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
          font-size: 0.95rem;
          color: #ffffff;
          flex-shrink: 0;
        }
        .ra-nav-restaurant-name {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 0.88rem;
          color: #0f172a;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .ra-nav-subtitle {
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-top: 0.1rem;
          font-weight: 600;
        }
        .ra-nav-section-label {
          padding: 0.75rem 0.5rem 0.35rem;
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #64748b;
          font-weight: 700;
          flex-shrink: 0;
        }
        .ra-nav-items {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
          overflow-y: auto;
        }
        .ra-nav-item {
          display: flex;
          align-items: center;
          padding: 0.55rem 0.75rem;
          border-radius: 4px;
          color: #475569;
          font-size: 0.84rem;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.1s;
          white-space: nowrap;
          letter-spacing: 0.005em;
        }
        .ra-nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .ra-nav-item.active {
          background: #fef3c7;
          color: #b45309;
          font-weight: 600;
          border-left: 3px solid #d97706;
          padding-left: calc(0.75rem - 3px);
        }
        .ra-nav-item-terminal {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          font-weight: 600;
        }
        .ra-nav-item-terminal:hover { background: #fef3c7; color: #78350f; }
        .ra-nav-item-terminal.active {
          background: #fef3c7;
          border-left: 3px solid #d97706;
          padding-left: calc(0.75rem - 3px);
        }
        .ra-nav-badge {
          font-size: 0.56rem;
          background: #d97706;
          color: #ffffff;
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .ra-nav-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 0.75rem;
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          flex-shrink: 0;
        }
        .ra-nav-profile {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.3rem 0.5rem;
        }
        .ra-nav-avatar {
          width: 26px;
          height: 26px;
          border-radius: 4px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.75rem;
          color: #334155;
          flex-shrink: 0;
          font-family: 'Outfit', sans-serif;
        }
        .ra-nav-profile-name { font-size: 0.8rem; font-weight: 600; color: #0f172a; }
        .ra-nav-profile-role { font-size: 0.6rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
        .ra-nav-logout {
          width: 100%;
          padding: 0.42rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          color: #64748b;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 500;
          transition: all 0.12s;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          letter-spacing: 0.02em;
        }
        .ra-nav-logout:hover {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #dc2626;
        }
      `}</style>
    </nav>
  )
}
