import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Users' }

export default async function UsersPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all branch members for this restaurant through branches
  const { data: rawMembers } = await supabase
    .from('branch_members')
    .select(`
      id, user_id, branch_id, role_id, is_active, created_at,
      branches!inner ( id, name, city, restaurant_id ),
      roles ( id, name ),
      profiles ( id, name, phone )
    `)
    .eq('branches.restaurant_id', ctx.restaurantId)
    .order('created_at', { ascending: false })

  const members = rawMembers ?? []

  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email ?? '—']))

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1>Users & Staff</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{members.length} staff member{members.length !== 1 ? 's' : ''} across all branches</p>
        </div>
        <Link href="/restaurant/users/invite" className="btn-primary">+ Add Staff Member</Link>
      </div>

      <div className="ra-section" style={{ padding: 0 }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Branch</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="sa-empty">
                    No staff yet. <Link href="/restaurant/users/invite">Add your first staff member →</Link>
                  </td>
                </tr>
              ) : (
                members.map((m: any) => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                  const branch = Array.isArray(m.branches) ? m.branches[0] : m.branches
                  const role = Array.isArray(m.roles) ? m.roles[0] : m.roles
                  const email = emailMap.get(m.user_id) ?? '—'
                  return (
                    <tr key={m.id}>
                      <td className="sa-td-name">
                        <div className="sa-avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{profile?.name ?? 'Unknown'}</span>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.875rem' }}>{email}</td>
                      <td style={{ color: '#334155', fontSize: '0.875rem' }}>{branch?.name ?? '—'}</td>
                      <td>
                        <span className="badge badge-blue">{role?.name ?? 'No Role'}</span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{profile?.phone ?? '—'}</td>
                      <td>
                        <span className={`badge ${m.is_active ? 'badge-green' : 'badge-red'}`}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/restaurant/users/${m.user_id}/edit`} className="link-action">Edit</Link>
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
