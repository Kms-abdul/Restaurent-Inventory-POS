import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { updateRestaurantSettingsAction } from '@/app/actions/restaurant-portal'

export const metadata = { title: 'Restaurant Settings' }

export default async function RestaurantSettingsPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // Fetch full restaurant details
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', ctx.restaurantId)
    .single()

  // Fetch branches with printer count
  const { data: branches } = await supabase
    .from('branches')
    .select(`
      id, name, city, phone, is_active,
      printers ( id, name, type, is_active )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .order('name')

  const branchList = branches ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '900px' }}>
      <div className="ra-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Restaurant Settings</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Configure restaurant identity, branches, and hardware setup
          </p>
        </div>
      </div>

      {/* General Settings Form */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>General Profile</h2>
        <form action={updateRestaurantSettingsAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Restaurant Name *</label>
              <input
                name="name"
                type="text"
                required
                defaultValue={restaurant?.name ?? ''}
                style={{
                  padding: '0.7rem 0.9rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Phone Number</label>
              <input
                name="phone"
                type="text"
                defaultValue={restaurant?.phone ?? ''}
                placeholder="+91 98765 43210"
                style={{
                  padding: '0.7rem 0.9rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Email Address</label>
              <input
                name="email"
                type="email"
                defaultValue={restaurant?.email ?? ''}
                placeholder="contact@restaurant.com"
                style={{
                  padding: '0.7rem 0.9rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>City</label>
              <input
                name="city"
                type="text"
                defaultValue={restaurant?.city ?? ''}
                placeholder="e.g. Hyderabad"
                style={{
                  padding: '0.7rem 0.9rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Address</label>
            <textarea
              name="address"
              rows={2}
              defaultValue={restaurant?.address ?? ''}
              placeholder="Full restaurant address"
              style={{
                padding: '0.7rem 0.9rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>

      {/* Branches & Hardware Overview */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Branches & Hardware Setup</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Manage printers and terminals per location</p>
          </div>
          <Link href="/restaurant/branches/new" className="btn-secondary" style={{ fontSize: '0.85rem' }}>+ Add Branch</Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {branchList.map((b: any) => {
            const printers = b.printers ?? []
            return (
              <div
                key={b.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🏪</span>
                    <strong style={{ color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>{b.name}</strong>
                    <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    📍 {b.city || 'No city'} · 🖨️ {printers.length} configured printer{printers.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <Link href={`/restaurant/branches/${b.id}/printers`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                    🖨️ Printers
                  </Link>
                  <Link href={`/restaurant/branches/${b.id}`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                    ✏️ Edit Branch
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Print Agent Info */}
      <div className="ra-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>🖨️ Thermal Receipt Printing Guide</h2>
        <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          To enable automated thermal printing for orders (KOTs in the kitchen and Customer Receipts at the counter), run the lightweight Print Agent on any Windows PC on the local network.
        </p>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 700, marginBottom: '0.25rem' }}>Quick Tip</div>
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>
            Ensure your printer name in Windows matches the name configured in the branch printer settings.
          </div>
        </div>
      </div>
    </div>
  )
}
