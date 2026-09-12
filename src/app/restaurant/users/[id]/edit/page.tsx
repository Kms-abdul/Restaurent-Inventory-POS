import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { updateStaffAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Edit Staff Member' }

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) notFound()

  // Get branch membership for this restaurant
  const { data: membership } = await supabase
    .from('branch_members')
    .select(`
      id, branch_id, role_id, is_active,
      branches!inner ( id, name, restaurant_id )
    `)
    .eq('user_id', userId)
    .eq('branches.restaurant_id', ctx.restaurantId)
    .single()

  // Get auth email
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: authUser } = await adminClient.auth.admin.getUserById(userId)

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  // Fetch roles
  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, is_default')
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const branchList = branches ?? []
  const roleList = roles ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '650px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/users" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Users
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Staff: {profile.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {authUser.user?.email ?? '—'}
          </p>
        </div>

        <span className={`badge ${profile.is_active ? 'badge-green' : 'badge-red'}`}>
          {profile.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <form action={updateStaffAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="user_id" value={userId} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Full Name *</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={profile.name}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Phone Number</label>
            <input
              name="phone"
              type="text"
              defaultValue={profile.phone ?? ''}
              placeholder="+91 98765 43210"
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Assigned Branch *</label>
            <select
              name="branch_id"
              required
              defaultValue={membership?.branch_id ?? branchList[0]?.id ?? ''}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              {branchList.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Assigned Role *</label>
            <select
              name="role_id"
              required
              defaultValue={membership?.role_id ?? roleList[0]?.id ?? ''}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              {roleList.map(r => (
                <option key={r.id} value={r.id}>{r.name} {r.is_default ? '(Default)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Reset Password</label>
            <input
              name="password"
              type="password"
              minLength={8}
              placeholder="Leave blank to keep current"
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Account Status</label>
            <select
              name="is_active"
              defaultValue={profile.is_active ? 'true' : 'false'}
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              <option value="true">Active (Can log into POS)</option>
              <option value="false">Suspended / Deactivated</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/restaurant/users" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  )
}
