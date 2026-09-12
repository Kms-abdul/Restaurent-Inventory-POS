import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext } from '@/utils/supabase/server'
import {
  updateRestaurantAdminProfile,
  updateRestaurantAdminEmail,
  updateRestaurantAdminPassword,
  toggleRestaurantAdminStatus,
  sendPasswordReset,
} from '@/app/actions/restaurant-admins'

export const metadata = { title: 'Edit Restaurant Admin — Super Admin' }

export default async function EditRestaurantAdminPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) redirect('/super-admin/restaurant-admins')

  // Fetch auth user (email, last login, etc.)
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId)

  // Fetch restaurant memberships
  const { data: memberships } = await adminClient
    .from('restaurant_members')
    .select(`
      id, is_active, created_at,
      restaurants ( id, name, city )
    `)
    .eq('user_id', userId)

  const isActive = profile.is_active !== false

  return (
    <div className="sa-page" style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div className="sa-page-header">
        <div>
          <Link href="/super-admin/restaurant-admins" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>← Back to Restaurant Admins</Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Admin: {profile.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {authUser?.email} · Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className={`badge ${isActive ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem' }}>
          {isActive ? '● Active' : '● Inactive'}
        </span>
      </div>

      {/* Restaurant Memberships */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Restaurant Memberships</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {(memberships ?? []).map((m: any) => {
            const r = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem 1.1rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🏪</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>{r?.name ?? '—'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r?.city ?? ''} · {m.is_active ? 'Active' : 'Inactive'}</div>
                </div>
                <Link href={`/super-admin/restaurants/${r?.id}`} className="link-action" style={{ marginLeft: '0.5rem', fontSize: '0.78rem' }}>
                  Manage →
                </Link>
              </div>
            )
          })}
          {(memberships ?? []).length === 0 && (
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No restaurant memberships assigned.</p>
          )}
        </div>
      </div>

      {/* Edit Profile */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>✏️ Edit Profile</h2>
        <form action={updateRestaurantAdminProfile} className="create-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <input type="hidden" name="user_id" value={userId} />
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Full Name *</label>
              <input type="text" name="name" defaultValue={profile.name} required style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Phone Number</label>
              <input type="tel" name="phone" defaultValue={profile.phone ?? ''} placeholder="+91 XXXXX XXXXX" style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">Save Profile</button>
          </div>
        </form>
      </div>

      {/* Change Email */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>📧 Change Email</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Current: <strong style={{ color: '#2563eb' }}>{authUser?.email ?? '—'}</strong>
        </p>
        <form action={updateRestaurantAdminEmail} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="hidden" name="user_id" value={userId} />
          <div className="form-group" style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>New Email Address</label>
            <input type="email" name="email" placeholder="new@example.com" required style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ height: 'fit-content' }}>Update Email</button>
        </form>
      </div>

      {/* Change Password */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>🔑 Set New Password</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Override the admin&apos;s password directly. They will be able to use this password to log in immediately.
        </p>
        <form action={updateRestaurantAdminPassword} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="hidden" name="user_id" value={userId} />
          <div className="form-group" style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>New Password (min. 8 characters)</label>
            <input type="password" name="password" minLength={8} placeholder="••••••••" required style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ height: 'fit-content' }}>Set Password</button>
        </form>
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
            Or send a password reset link to <strong style={{ color: '#2563eb' }}>{authUser?.email}</strong>:
          </p>
          <form action={sendPasswordReset}>
            <input type="hidden" name="email" value={authUser?.email ?? ''} />
            <button type="submit" className="btn-secondary" style={{ fontSize: '0.85rem' }}>
              📨 Send Password Reset Email
            </button>
          </form>
        </div>
      </div>

      {/* Account Status */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.35rem' }}>⚠️ Account Status</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          {isActive
            ? 'This admin is currently active. Deactivating will immediately block their access and prevent them from logging in.'
            : 'This admin is currently deactivated. Re-activating will restore their login access.'}
        </p>
        <form action={toggleRestaurantAdminStatus}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="is_active" value={String(isActive)} />
          <button
            type="submit"
            className={isActive ? 'btn-secondary' : 'btn-primary'}
            style={{
              color: isActive ? '#dc2626' : undefined,
              borderColor: isActive ? '#fecaca' : undefined,
              background: isActive ? '#fef2f2' : undefined,
            }}
          >
            {isActive ? '🚫 Deactivate Admin' : '✅ Reactivate Admin'}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>ℹ️ Account Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'User ID',      value: userId,                                                     mono: true },
            { label: 'Email',        value: authUser?.email ?? '—' },
            { label: 'Created',      value: new Date(profile.created_at).toLocaleDateString('en-IN') },
            { label: 'Last Login',   value: authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString('en-IN') : 'Never' },
            { label: 'Auth Provider', value: authUser?.app_metadata?.provider ?? 'email' },
          ].map(item => (
            <div key={item.label} style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: item.mono ? '0.72rem' : '0.875rem', fontFamily: item.mono ? 'monospace' : undefined, color: '#0f172a', fontWeight: 600, wordBreak: 'break-all' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
