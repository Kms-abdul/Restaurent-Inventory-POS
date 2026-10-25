'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Profile } from '@/types/database'

const NAV_ITEMS = [
  { href: '/super-admin/dashboard',         label: 'Dashboard' },
  { href: '/super-admin/restaurants',       label: 'Restaurants' },
  { href: '/super-admin/restaurant-admins', label: 'Restaurant Admins' },
  { href: '/super-admin/administrators',    label: 'Super Admins' },
  { href: '/staff/pos',                     label: 'POS Terminal' },
  { href: '/staff/kitchen',                 label: 'Kitchen KOT' },
  { href: '/super-admin/settings',          label: 'Settings' },
]

export default function SuperAdminNav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Clear pending state and close drawer when route resolves
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
      <header className="sa-mobile-header">
        <button
          className="sa-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          type="button"
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
        </button>
        <div className="sa-mobile-brand">
          <div className="sa-nav-wordmark-icon" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
            R
          </div>
          <span className="sa-mobile-title">RestaurantOS</span>
        </div>
        <Link href="/staff/pos" className="sa-mobile-pos-link">
          ⚡ POS
        </Link>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={`sa-mobile-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav className={`sa-nav ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sa-nav-brand">
          <div className="sa-nav-wordmark-icon">R</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sa-nav-title">RestaurantOS</div>
            <div className="sa-nav-subtitle">Super Admin</div>
          </div>
          <button
            className="sa-mobile-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="sa-nav-items">
          {NAV_ITEMS.map(item => {
            const isPending = pendingHref === item.href
            const isActive  = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className={`sa-nav-item ${isActive ? 'active' : ''} ${isPending ? 'nav-item-pending' : ''}`}
                id={`nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="sa-nav-footer">
          <div className="sa-nav-profile">
            <div className="sa-nav-avatar">{profile.name.charAt(0)}</div>
            <div className="sa-nav-profile-info">
              <div className="sa-nav-profile-name">{profile.name}</div>
              <div className="sa-nav-profile-role">Super Admin</div>
            </div>
          </div>
          <button
            className={`sa-nav-logout ${loggingOut ? 'btn-loading' : ''}`}
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
          .sa-mobile-header {
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
          .sa-mobile-toggle {
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
          .sa-mobile-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .sa-mobile-title {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            font-size: 0.95rem;
            color: #0f172a;
          }
          .sa-mobile-pos-link {
            background: #0d9488;
            color: #ffffff;
            padding: 0.35rem 0.75rem;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 700;
            text-decoration: none;
          }
          .sa-mobile-backdrop {
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
          .sa-mobile-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }
          .sa-mobile-close-btn {
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
          .sa-nav {
            width: 220px;
            flex-shrink: 0;
            background: #ffffff;
            border-right: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 1.25rem 0.75rem;
            font-family: 'Space Grotesk', 'Inter', sans-serif;
            transition: transform 0.25s ease-in-out;
            z-index: 99;
          }
          .sa-nav-brand {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            padding: 0.35rem 0.5rem 1.5rem;
          }
          .sa-nav-wordmark-icon {
            width: 30px;
            height: 30px;
            background: #0d9488;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Outfit', sans-serif;
            font-weight: 800;
            font-size: 0.95rem;
            color: #ffffff;
            flex-shrink: 0;
          }
          .sa-nav-title {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            font-size: 0.88rem;
            color: #0f172a;
            letter-spacing: -0.01em;
          }
          .sa-nav-subtitle {
            font-size: 0.62rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-weight: 600;
            margin-top: 0.1rem;
          }
          .sa-nav-items {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            flex: 1;
            overflow-y: auto;
          }
          .sa-nav-item {
            display: flex;
            align-items: center;
            padding: 0.55rem 0.75rem;
            border-radius: 4px;
            color: #475569;
            font-size: 0.84rem;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.12s, background 0.12s;
            letter-spacing: 0.005em;
          }
          .sa-nav-item:hover {
            background: #f1f5f9;
            color: #0f172a;
          }
          .sa-nav-item.active {
            background: #ccfbf1;
            color: #0f766e;
            font-weight: 600;
            border-left: 3px solid #0d9488;
            padding-left: calc(0.75rem - 3px);
          }
          .sa-nav-footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 0.875rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .sa-nav-profile {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            padding: 0.35rem 0.5rem;
          }
          .sa-nav-avatar {
            width: 28px;
            height: 28px;
            border-radius: 4px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.78rem;
            color: #334155;
            flex-shrink: 0;
            font-family: 'Outfit', sans-serif;
          }
          .sa-nav-profile-name {
            font-size: 0.8rem;
            font-weight: 600;
            color: #0f172a;
          }
          .sa-nav-profile-role {
            font-size: 0.62rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-top: 0.05rem;
          }
          .sa-nav-logout {
            width: 100%;
            padding: 0.45rem;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            color: #64748b;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 500;
            transition: all 0.12s;
            font-family: 'Space Grotesk', 'Inter', sans-serif;
            letter-spacing: 0.02em;
          }
          .sa-nav-logout:hover {
            background: #fef2f2;
            color: #dc2626;
            border-color: #fca5a5;
          }

          /* Mobile Styles */
          @media screen and (max-width: 900px) {
            .sa-mobile-header {
              display: flex;
            }
            .sa-mobile-backdrop {
              display: block;
            }
            .sa-mobile-close-btn {
              display: flex;
            }
            .sa-nav {
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
            .sa-nav.mobile-open {
              transform: translateX(0);
              box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
            }
          }
        `}</style>
      </nav>
    </>
  )
}
