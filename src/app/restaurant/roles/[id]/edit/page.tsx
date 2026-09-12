import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { updateRoleAction, deleteRoleAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Edit Role' }

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch role
  const { data: role } = await supabase
    .from('roles')
    .select('id, name, description, is_default, role_permissions(permission)')
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!role) notFound()

  // Fetch permissions registry
  const { data: permissions } = await supabase
    .from('permissions')
    .select('*')
    .order('category')
    .order('key')

  const perms = permissions ?? []
  const currentPerms = new Set((role.role_permissions ?? []).map((rp: any) => rp.permission))

  // Group by category
  const categories: { [cat: string]: typeof perms } = {}
  perms.forEach(p => {
    if (!categories[p.category]) categories[p.category] = []
    categories[p.category].push(p)
  })

  return (
    <div className="ra-page" style={{ maxWidth: '800px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/roles" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Roles
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Edit Role: {role.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {role.is_default ? 'Configure permissions for this standard role' : 'Update title, description, and granted permissions'}
          </p>
        </div>
      </div>

      <form action={updateRoleAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input type="hidden" name="role_id" value={role.id} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Role Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={role.name}
            readOnly={role.is_default}
            style={{
              padding: '0.75rem 1rem',
              background: role.is_default ? '#f8fafc' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              color: role.is_default ? '#64748b' : '#0f172a',
              fontSize: '0.95rem',
            }}
          />
          {role.is_default && (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              🔒 Default system role names cannot be renamed, but you can configure their permissions below.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={role.description ?? ''}
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

        <div>
          <label style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '1rem' }}>
            Role Permissions
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.entries(categories).map(([category, items]) => (
              <div key={category} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <h3 style={{ textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.08em', color: '#b45309', fontWeight: 700, marginBottom: '0.85rem' }}>
                  {category}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {items.map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={item.key}
                        defaultChecked={currentPerms.has(item.key)}
                        style={{ marginTop: '0.2rem', accentColor: '#f59e0b' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{item.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>{item.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <div>
            {!role.is_default && (
              <form action={async () => {
                'use server'
                await deleteRoleAction(role.id)
                redirect('/restaurant/roles')
              }}>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Delete Custom Role
                </button>
              </form>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/restaurant/roles" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </div>
      </form>
    </div>
  )
}
