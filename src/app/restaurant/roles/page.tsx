import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Roles & Permissions' }

export default async function RolesPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch roles for this restaurant with their permissions
  const { data: roles } = await supabase
    .from('roles')
    .select(`
      id, name, description, is_default, created_at,
      role_permissions ( permission )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const allRoles = roles ?? []

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Control staff access levels and terminal privileges
          </p>
        </div>
        <Link href="/restaurant/roles/new" className="btn-primary">+ Add Custom Role</Link>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
        {allRoles.map((role: any) => {
          const perms: string[] = (role.role_permissions ?? []).map((rp: any) => rp.permission)
          return (
            <div
              key={role.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '1rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>
                      {role.name.toLowerCase().includes('cashier') ? '💵' :
                       role.name.toLowerCase().includes('chef') ? '👨‍🍳' :
                       role.name.toLowerCase().includes('maker') ? '🍕' :
                       role.name.toLowerCase().includes('manager') ? '👔' : '🔐'}
                    </span>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{role.name}</h2>
                  </div>
                  <span className={`badge ${role.is_default ? 'badge-blue' : 'badge-amber'}`}>
                    {role.is_default ? 'System Default' : 'Custom'}
                  </span>
                </div>

                <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '1.25rem', minHeight: '38px', lineHeight: '1.4' }}>
                  {role.description || 'No description provided.'}
                </p>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
                    Permissions ({perms.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {perms.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No permissions assigned</span>
                    ) : (
                      perms.map(p => (
                        <span
                          key={p}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.4rem',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            color: '#1e293b',
                            fontWeight: 500,
                            fontFamily: 'monospace',
                          }}
                        >
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Link href={`/restaurant/roles/${role.id}/edit`} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                  ✏️ Configure Permissions
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
