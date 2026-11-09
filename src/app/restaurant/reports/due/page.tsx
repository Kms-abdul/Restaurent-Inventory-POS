import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import DueBills, { type DueOrder } from './DueBills'

export const metadata = { title: 'Due Bills' }

const SELECT = `
  id, order_no, total_amount, payment_mode, table_number, notes, created_at,
  branches ( name ),
  order_items ( item_name_at_sale, qty, line_total )
`

const toDueOrder = (o: any): DueOrder => ({
  id: o.id,
  order_no: o.order_no,
  created_at: o.created_at,
  branchName: (Array.isArray(o.branches) ? o.branches[0]?.name : o.branches?.name) ?? null,
  table_number: o.table_number ?? null,
  payment_mode: o.payment_mode,
  notes: o.notes ?? null,
  total_amount: o.total_amount || 0,
  items: (o.order_items ?? []).map((i: any) => ({ name: i.item_name_at_sale, qty: i.qty, line_total: i.line_total })),
})

export default async function DueBillsPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  const [{ data: dueData, error: dueError }, { data: paidData }] = await Promise.all([
    supabase
      .from('orders')
      .select(SELECT)
      .eq('restaurant_id', ctx.restaurantId)
      .eq('status', 'settled')
      .eq('payment_mode', 'due')
      .order('created_at', { ascending: true }),
    supabase
      .from('orders')
      .select(SELECT)
      .eq('restaurant_id', ctx.restaurantId)
      .eq('status', 'settled')
      .like('notes', '%[Due paid:%')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const due = (dueData ?? []).map(toDueOrder)
  const paid = (paidData ?? []).map(toDueOrder)
  const totalDueRupees = due.reduce((sum, o) => sum + o.total_amount, 0) / 100

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/reports" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← All Reports
          </Link>
          <h1 style={{ color: '#0f172a' }}>Due Bills</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Bills customers will pay later. Mark a bill as paid when the money is received.
          </p>
        </div>
      </div>

      {dueError && (
        <div style={{ marginBottom: '1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
          Could not load Due bills: {dueError.message}. If this mentions payment_mode, run the Due / Swiggy-Zomato SQL in Supabase first.
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card kpi-revenue">
          <div className="kpi-icon">🕒</div>
          <div className="kpi-content">
            <div className="kpi-label">Total Outstanding</div>
            <div className="kpi-value">₹{totalDueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="kpi-card kpi-orders">
          <div className="kpi-icon">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Unpaid Bills</div>
            <div className="kpi-value">{due.length}</div>
          </div>
        </div>
      </div>

      <DueBills due={due} paid={paid} />
    </div>
  )
}
