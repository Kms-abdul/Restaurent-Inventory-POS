'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'

const NAV_ITEMS = [
  { href: '/super-admin/dashboard',         label: 'Dashboard',          icon: '📊' },
  { href: '/super-admin/restaurants',       label: 'Restaurants',        icon: '🏪' },
  { href: '/super-admin/restaurant-admins', label: 'Restaurant Admins',  icon: '🧑‍💼' },
  { href: '/super-admin/administrators',    label: 'Super Admins',       icon: '👑' },
  { href: '/staff/pos',                     label: 'POS Terminal',       icon: '🖥️' },
  { href: '/staff/kitchen',                 label: 'Kitchen KOT',        icon: '👨‍🍳' },
  { href: '/super-admin/settings',          label: 'Settings',           icon: '⚙️' },
]

export default function SuperAdminNav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sa-nav">
      <div className="sa-nav-brand">
        <span className="sa-nav-icon">🍽️</span>
        <div>
          <div className="sa-nav-title">Platform</div>
          <div className="sa-nav-subtitle">Super Admin</div>
        </div>
      </div>

      <div className="sa-nav-items">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sa-nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase()}`}
          >
            <span className="sa-nav-item-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="sa-nav-footer">
        <div className="sa-nav-profile">
          <div className="sa-nav-avatar">{profile.name.charAt(0)}</div>
          <div className="sa-nav-profile-info">
            <div className="sa-nav-profile-name">{profile.name}</div>
            <div className="sa-nav-profile-role">Super Admin</div>
          </div>
        </div>
        <button className="sa-nav-logout" onClick={handleLogout} id="logoutBtn">
          Sign out
        </button>
      </div>

      <style jsx>{`
        .sa-nav {
          width: 240px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 1.25rem 0.75rem;
          font-family: 'Inter', sans-serif;
          box-shadow: 1px 0 3px rgba(0, 0, 0, 0.02);
        }
        .sa-nav-brand { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem 1.5rem; }
        .sa-nav-icon { font-size: 1.75rem; }
        .sa-nav-title { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1rem; color: #0f172a; }
        .sa-nav-subtitle { font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .sa-nav-items { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
        .sa-nav-item {
          display: flex; align-items: center; gap: 0.65rem;
          padding: 0.7rem 0.85rem;
          border-radius: 0.6rem;
          color: #475569;
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.15s;
        }
        .sa-nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .sa-nav-item.active { background: #ede9fe; color: #6d28d9; font-weight: 700; border-left: 3px solid #7c3aed; }
        .sa-nav-item-icon { font-size: 1rem; }
        .sa-nav-footer { border-top: 1px solid #e2e8f0; padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .sa-nav-profile { display: flex; align-items: center; gap: 0.65rem; padding: 0.5rem 0.5rem; }
        .sa-nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: #ffffff; flex-shrink: 0; }
        .sa-nav-profile-name { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
        .sa-nav-profile-role { font-size: 0.72rem; color: #64748b; }
        .sa-nav-logout { width: 100%; padding: 0.55rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; color: #dc2626; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.15s; }
        .sa-nav-logout:hover { background: #fee2e2; color: #b91c1c; }
      `}</style>
    </nav>
  )
}
