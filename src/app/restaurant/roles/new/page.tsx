import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { createRoleAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'New Role' }

export default async function NewRolePage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const { data: permissions } = await supabase
    .from('permissions')
    .select('*')
    .order('category')
    .order('key')

  const perms = permissions ?? []

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
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Create Custom Role</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Define custom role title and grant specific feature permissions
          </p>
        </div>
      </div>

      <form action={createRoleAction} className="ra-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Role Name *</label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Supervisor, Bartender, Inventory Auditor"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Brief explanation of responsibilities and terminal privileges"
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
            Assign Permissions
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Link href="/restaurant/roles" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save Role</button>
        </div>
      </form>
    </div>
  )
}
