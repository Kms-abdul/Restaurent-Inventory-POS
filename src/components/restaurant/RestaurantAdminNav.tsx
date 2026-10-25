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
  const [mobileOpen, setMobileOpen] = useState(false)

  // Clear pending state and close mobile drawer when route resolves
  useEffect(() => {
    setPendingHref(null)
    setMobileOpen(false)
  }, [pathname])

  const handleNavClick = (href: string) => {
    if (href === pathname) {
      setMobileOpen(false)
      return
    }
    setPendingHref(href)
    setMobileOpen(false)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }


  return (
    <>
      {/* Mobile Top Header (<= 900px) */}
      <header className="ra-mobile-header">
        <button
          className="ra-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          type="button"
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
        </button>
        <div className="ra-mobile-brand">
          <div className="ra-nav-restaurant-avatar" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
            {restaurant.name.charAt(0)}
          </div>
          <span className="ra-mobile-title">{restaurant.name}</span>
        </div>
        <Link href="/staff/pos" className="ra-mobile-pos-link">
          ⚡ POS
        </Link>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={`ra-mobile-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav className={`ra-nav ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="ra-nav-brand">
          <div className="ra-nav-restaurant-avatar">{restaurant.name.charAt(0)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ra-nav-restaurant-name">{restaurant.name}</div>
            <div className="ra-nav-subtitle">Restaurant Admin</div>
          </div>
          <button
            className="ra-mobile-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            type="button"
          >
            ✕
          </button>
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
          /* Mobile Header & Backdrop */
          .ra-mobile-header {
            display: none;
            align-items: center;
            justify-content: space-between;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 0.65rem 1rem;
            position: sticky;
            top: 0;
            z-index: 90;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          }
          .ra-mobile-toggle {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #0f172a;
          }
          .ra-mobile-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .ra-mobile-title {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            font-size: 0.95rem;
            color: #0f172a;
          }
          .ra-mobile-pos-link {
            background: #d97706;
            color: #ffffff;
            padding: 0.35rem 0.75rem;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 700;
            text-decoration: none;
          }
          .ra-mobile-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
            z-index: 98;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }
          .ra-mobile-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }
          .ra-mobile-close-btn {
            display: none;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            width: 30px;
            height: 30px;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            cursor: pointer;
            color: #475569;
          }

          /* Desktop Nav */
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
            transition: transform 0.25s ease-in-out;
            z-index: 99;
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
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            color: #475569;
            font-size: 0.84rem;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.12s;
            white-space: nowrap;
            letter-spacing: 0.005em;
          }
          .ra-nav-item:hover { background: #f1f5f9; color: #0f172a; }
          .ra-nav-item.active {
            background: #0f172a;
            color: #ffffff;
            font-weight: 600;
          }
          .ra-nav-item-terminal {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #0f172a;
            font-weight: 500;
          }
          .ra-nav-item-terminal:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }
          .ra-nav-item-terminal.active {
            background: #0f172a;
            border-color: #0f172a;
            color: #ffffff;
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

          /* Mobile Styles */
          @media screen and (max-width: 900px) {
            .ra-mobile-header {
              display: flex;
            }
            .ra-mobile-backdrop {
              display: block;
            }
            .ra-mobile-close-btn {
              display: flex;
            }
            .ra-nav {
              position: fixed;
              top: 0;
              left: 0;
              bottom: 0;
              width: 270px;
              max-width: 85vw;
              transform: translateX(-100%);
              box-shadow: none;
              padding-top: 1rem;
            }
            .ra-nav.mobile-open {
              transform: translateX(0);
              box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
            }
          }
        `}</style>
      </nav>
    </>
  )
}
