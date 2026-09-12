'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Branch, Restaurant, PermissionKey } from '@/types/database'

interface Props {
  profile: Profile
  branch: Branch
  restaurant: Restaurant
  permissions: Set<PermissionKey>
}

export default function StaffNav({ profile, branch, restaurant, permissions }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/staff/pos',     label: 'POS',     permission: 'pos.create_order' as PermissionKey },
    { href: '/staff/kitchen', label: 'Kitchen', permission: 'kitchen.view' as PermissionKey },
    { href: '/staff/orders',  label: 'Orders',  permission: 'pos.create_order' as PermissionKey },
  ].filter(item => permissions.has(item.permission))

  return (
    <header className="staff-header">
      <div className="staff-header-left">
        <div className="staff-brand-badge">
          {restaurant.name.charAt(0)}
        </div>
        <div className="staff-brand-text">
          <span className="staff-brand-restaurant">{restaurant.name}</span>
          <span className="staff-brand-sep" />
          <span className="staff-brand-branch">{branch.name}</span>
        </div>
      </div>

      <nav className="staff-nav-tabs">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`staff-nav-tab ${pathname === item.href ? 'active' : ''}`}
            id={`tab-${item.label.toLowerCase()}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="staff-header-right">
        <div className="staff-user-chip">
          <span className="staff-user-initial">{profile.name.charAt(0)}</span>
          <span>{profile.name.split(' ')[0]}</span>
        </div>
        <button className="staff-logout" onClick={handleLogout} id="staffLogoutBtn" aria-label="Sign out">
          ↩
        </button>
      </div>

      <style jsx>{`
        .staff-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 52px;
          padding: 0 1.25rem;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          flex-shrink: 0;
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          gap: 1rem;
        }
        .staff-header-left { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
        .staff-brand-badge {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background: #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #ffffff;
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .staff-brand-text { display: flex; align-items: center; gap: 0.5rem; font-size: 0.84rem; overflow: hidden; }
        .staff-brand-restaurant { font-weight: 700; color: #0f172a; white-space: nowrap; }
        .staff-brand-sep {
          width: 1px;
          height: 12px;
          background: #cbd5e1;
          flex-shrink: 0;
        }
        .staff-brand-branch { color: #64748b; white-space: nowrap; font-weight: 500; font-size: 0.78rem; }
        .staff-nav-tabs { display: flex; gap: 0.25rem; }
        .staff-nav-tab {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.5rem 1rem;
          color: #64748b;
          font-size: 0.82rem;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.1s;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          letter-spacing: 0.01em;
          border-radius: 4px 4px 0 0;
        }
        .staff-nav-tab:hover { color: #0f172a; background: #f8fafc; }
        .staff-nav-tab.active {
          color: #d97706;
          border-bottom-color: #d97706;
          font-weight: 600;
          background: #fffbeb;
        }
        .staff-tab-glyph {
          font-size: 0.85rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .staff-header-right { display: flex; align-items: center; gap: 0.625rem; }
        .staff-user-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          color: #475569;
          white-space: nowrap;
          font-weight: 600;
        }
        .staff-user-initial {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.68rem;
          font-weight: 700;
          color: #334155;
          font-family: 'Outfit', sans-serif;
          flex-shrink: 0;
        }
        .staff-logout {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          cursor: pointer;
          padding: 0.3rem 0.5rem;
          border-radius: 4px;
          transition: all 0.12s;
          font-size: 0.85rem;
          line-height: 1;
        }
        .staff-logout:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
      `}</style>
    </header>
  )
}
