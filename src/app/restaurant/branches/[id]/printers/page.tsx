import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { addPrinter, deletePrinter } from '@/app/actions/printers'

export const metadata = { title: 'Branch Printers' }

export default async function BranchPrintersPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Get printers for branch
  const { data: printers } = await supabase
    .from('printers')
    .select('*')
    .eq('branch_id', branch.id)
    .order('created_at', { ascending: true })

  const printerList = printers ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '800px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/branches" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Branches
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Printers: {branch.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Configure thermal receipt and kitchen order ticket (KOT) printers for this location
          </p>
        </div>
      </div>

      {/* Existing Printers List */}
      <div className="ra-section" style={{ marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Active Printers ({printerList.length})</h2>

        {printerList.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', padding: '1rem 0' }}>
            No printers configured yet. Use the form below to add a printer.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {printerList.map((p: any) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{p.type === 'kitchen' ? '👨‍🍳' : '🧾'}</span>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{p.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Type: <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{p.type} Printer</span>
                    </div>
                  </div>
                </div>

                <form action={deletePrinter}>
                  <input type="hidden" name="printer_id" value={p.id} />
                  <button
                    type="submit"
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      borderRadius: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Printer Form */}
      <div className="ra-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>+ Add New Printer</h2>
        <form action={addPrinter} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <input type="hidden" name="branch_id" value={branch.id} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Windows Printer Name *</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. POS-80, Thermal Kitchen, EPSON TM-T82"
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Must match the exact printer name shown in Windows &quot;Printers &amp; scanners&quot; settings on the local terminal.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>Printer Type *</label>
            <select
              name="type"
              required
              defaultValue="receipt"
              style={{
                padding: '0.75rem 1rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                color: '#0f172a',
                fontSize: '0.95rem',
              }}
            >
              <option value="receipt">Customer Receipt Printer (Cashier Counter)</option>
              <option value="kitchen">Kitchen Order Ticket (KOT) Printer</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary">Add Printer</button>
          </div>
        </form>
      </div>
    </div>
  )
}
