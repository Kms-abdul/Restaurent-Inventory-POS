import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const metadata = { title: 'Branch Staff' }

export default async function BranchStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Get branch
  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, city')
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!branch) notFound()

  // Get members of this branch
  const { data: members } = await supabase
    .from('branch_members')
    .select(`
      id, user_id, is_active, created_at,
      roles ( id, name ),
      profiles ( id, name, phone )
    `)
    .eq('branch_id', branch.id)
    .order('created_at', { ascending: false })

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email ?? '—']))

  const staffList = members ?? []

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/branches" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Branches
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Staff: {branch.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {staffList.length} assigned staff member{staffList.length !== 1 ? 's' : ''} at this location
          </p>
        </div>

        <Link href={`/restaurant/users/invite?branch=${branch.id}`} className="btn-primary">
          + Add Staff to Branch
        </Link>
      </div>

      <div className="ra-section" style={{ padding: 0, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-empty">
                    No staff assigned to this branch yet.{' '}
                    <Link href={`/restaurant/users/invite?branch=${branch.id}`}>Add staff member →</Link>
                  </td>
                </tr>
              ) : (
                staffList.map((m: any) => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
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
