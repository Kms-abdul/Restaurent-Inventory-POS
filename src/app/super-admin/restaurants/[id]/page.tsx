import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getUserContext } from '@/utils/supabase/server'
import { deletePrinter, addPrinter } from '@/app/actions/printers'

export default async function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(`
      *,
      branches (
        id,
        name,
        city,
        printers (*)
      )
    `)
    .eq('id', id)
    .single()

  if (!restaurant) redirect('/super-admin/dashboard')

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <Link href="/super-admin/restaurants" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>← Back to Restaurants</Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>{restaurant.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Manage restaurant settings and print setup</p>
        </div>
      </div>

      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="sa-section-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>Branches &amp; Print Setup</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {restaurant.branches.map((branch: any) => (
            <div key={branch.id} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{branch.name}</h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{branch.city}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Branch ID: {branch.id}</div>
              </div>

              {/* Printer List */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, marginBottom: '0.75rem' }}>Configured Printers</h4>
                {branch.printers.length === 0 ? (
                  <div className="sa-empty" style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', color: '#64748b' }}>No printers configured for this branch.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {branch.printers.map((printer: any) => (
                      <div key={printer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.75rem 1rem', borderRadius: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>{printer.type === 'receipt' ? '🧾' : '🍳'}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{printer.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{printer.type.toUpperCase()} Printer</div>
                          </div>
                        </div>
                        <form action={deletePrinter}>
                          <input type="hidden" name="printer_id" value={printer.id} />
                          <button type="submit" className="btn-secondary" style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>Remove</button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Printer Form */}
              <form action={addPrinter} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '0.75rem' }}>
                <input type="hidden" name="branch_id" value={branch.id} />
                
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Windows Printer Name</label>
                  <input type="text" name="name" placeholder="e.g. POS-80 or Kitchen-80" required style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }} />
                </div>
                
                <div className="form-group" style={{ width: '200px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.3rem', display: 'block' }}>Printer Type</label>
                  <select name="type" required style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', color: '#0f172a' }}>
                    <option value="receipt">Receipt (Front Desk)</option>
                    <option value="kitchen">Kitchen (KOT)</option>
                  </select>
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.25rem', height: 'fit-content' }}>
                  + Add Printer
                </button>
              </form>

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
