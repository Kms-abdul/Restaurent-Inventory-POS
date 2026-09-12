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
    { href: '/staff/pos', label: 'POS', icon: '🖥️', permission: 'pos.create_order' as PermissionKey },
    { href: '/staff/kitchen', label: 'Kitchen', icon: '👨‍🍳', permission: 'kitchen.view' as PermissionKey },
    { href: '/staff/orders', label: 'Orders', icon: '📋', permission: 'pos.create_order' as PermissionKey },
  ].filter(item => permissions.has(item.permission))

  return (
    <header className="staff-header">
      <div className="staff-header-left">
        <div className="staff-brand-badge">
          {restaurant.name.charAt(0)}
        </div>
        <div className="staff-brand-text">
          <span className="staff-brand-restaurant">{restaurant.name}</span>
          <span className="staff-brand-separator">·</span>
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
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="staff-header-right">
        <div className="staff-user-chip">
          👤 <span>{profile.name.split(' ')[0]}</span>
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
          height: 56px;
          padding: 0 1rem;
          background: #ffffff;
          border-bottom: 2px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
          font-family: 'Inter', sans-serif;
          gap: 1rem;
        }
        .staff-header-left { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
        .staff-brand-badge {
          width: 32px; height: 32px; border-radius: 0.5rem;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; color: #fff; font-family: 'Outfit', sans-serif; font-size: 1rem;
          flex-shrink: 0;
        }
        .staff-brand-text { display: flex; align-items: center; gap: 0.35rem; font-size: 0.875rem; overflow: hidden; }
        .staff-brand-restaurant { font-weight: 700; color: #0f172a; white-space: nowrap; }
        .staff-brand-separator { color: #cbd5e1; }
        .staff-brand-branch { color: #64748b; white-space: nowrap; font-weight: 500; }
        .staff-nav-tabs { display: flex; gap: 0.35rem; }
        .staff-nav-tab {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: 0.6rem;
          color: #475569;
          font-size: 0.85rem; text-decoration: none;
          font-weight: 500;
          transition: all 0.15s;
        }
        .staff-nav-tab:hover { background: #f1f5f9; color: #0f172a; }
        .staff-nav-tab.active { background: #ede9fe; color: #6d28d9; font-weight: 700; }
        .staff-header-right { display: flex; align-items: center; gap: 0.5rem; }
        .staff-user-chip { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: #475569; white-space: nowrap; font-weight: 500; }
        .staff-logout { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.1rem; padding: 0.35rem; border-radius: 0.4rem; transition: all 0.15s; }
        .staff-logout:hover { background: #fee2e2; color: #dc2626; }
      `}</style>
    </header>
  )
}
