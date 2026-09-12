import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext } from '@/utils/supabase/server'
import { inviteSuperAdmin, revokeSuperAdmin } from '@/app/actions/administrators'

export const metadata = { title: 'Administrators — Super Admin' }

export default async function AdministratorsPage() {
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all platform members with their profiles
  const { data: rawMembers } = await adminClient
    .from('platform_members')
    .select(`
      id,
      is_active,
      created_at,
      user_id,
      profiles (id, name, phone, avatar_url)
    `)
    .order('created_at', { ascending: false })
  const members = rawMembers ?? []

  // Get emails from auth (admin API)
  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers.users.map(u => [u.id, u.email]))

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Administrators</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage platform-level Super Admin accounts
          </p>
        </div>
      </div>

      {/* Invite Form */}
      <div className="sa-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>Invite New Super Admin</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
          The new admin will receive an email to set their password and gain full platform access.
        </p>
        <form action={inviteSuperAdmin} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Full Name</label>
            <input type="text" name="name" placeholder="e.g. John Smith" required style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Email Address</label>
            <input type="email" name="email" placeholder="e.g. john@example.com" required style={{ padding: '0.65rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ height: 'fit-content' }}>
            Invite Admin
          </button>
        </form>
      </div>

      {/* Admins Table */}
      <div className="sa-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Current Super Admins</h2>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">No administrators found.</td>
                </tr>
              ) : (
                members.map((m: any) => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                  const email = emailMap.get(m.user_id) ?? '—'
                  const isCurrentUser = m.user_id === ctx.userId
                  return (
                    <tr key={m.id}>
                      <td className="sa-td-name">
                        <div className="sa-avatar" style={{ background: isCurrentUser ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : undefined }}>
                          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {profile?.name ?? 'Unknown'}
                            {isCurrentUser && (
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#4338ca', background: '#e0e7ff', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.875rem' }}>{email}</td>
                      <td>
                        <span className={`badge ${m.is_active ? 'badge-green' : 'badge-red'}`}>
                          {m.is_active ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {new Date(m.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        {!isCurrentUser && m.is_active && (
                          <form action={revokeSuperAdmin}>
                            <input type="hidden" name="user_id" value={m.user_id} />
                            <button
                              type="submit"
                              className="btn-secondary"
                              style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              onClick={e => !confirm('Revoke Super Admin access for this user?') && e.preventDefault()}
                            >
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
