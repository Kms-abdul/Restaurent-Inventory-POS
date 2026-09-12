import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient, createServiceClient } from '@/utils/supabase/server'
import KitchenDisplay from '@/components/kitchen/KitchenDisplay'

export const metadata = { title: 'Kitchen Display System (KOT)' }

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; restaurant?: string }>
}) {
  const { branch: requestedBranchId, restaurant: requestedRestaurantId } = await searchParams
  const ctx = await getUserContext()

  if (!ctx) redirect('/login')

  const serviceSupabase = await createServiceClient()
  const supabase = await createClient()

  let activeBranchId: string | null = ctx.branchId
  let activeRestaurantId: string | null = ctx.restaurantId
  let canUpdate = ctx.permissions.has('kitchen.update')
  let branchesList: { id: string; name: string }[] = []

  if (ctx.isSuperAdmin) {
    canUpdate = true

    const { data: allRestaurants } = await serviceSupabase
      .from('restaurants')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (!allRestaurants || allRestaurants.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Restaurants Found</h2>
          <Link href="/super-admin/restaurants/new" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>+ Create Restaurant</Link>
        </div>
      )
    }

    const selectedRestaurant = requestedRestaurantId
      ? allRestaurants.find(r => r.id === requestedRestaurantId) ?? allRestaurants[0]
      : allRestaurants[0]

    activeRestaurantId = selectedRestaurant.id

    const { data: branches } = await serviceSupabase
      .from('branches')
      .select('id, name')
      .eq('restaurant_id', activeRestaurantId)
      .eq('is_active', true)
      .order('name')

    branchesList = branches ?? []

    if (branchesList.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Branches Found</h2>
          <Link href="/restaurant/branches/new" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>+ Add Branch</Link>
        </div>
      )
    }

    const selectedBranch = requestedBranchId
      ? branchesList.find(b => b.id === requestedBranchId) ?? branchesList[0]
      : branchesList[0]

    activeBranchId = selectedBranch.id
  } else if (ctx.restaurantId && !ctx.branchId) {
    canUpdate = true
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('restaurant_id', ctx.restaurantId)
      .eq('is_active', true)
      .order('name')

    branchesList = branches ?? []

    if (branchesList.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Branches Found</h2>
          <Link href="/restaurant/branches/new" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>+ Add Branch</Link>
        </div>
      )
    }

    const selectedBranch = requestedBranchId
      ? branchesList.find(b => b.id === requestedBranchId) ?? branchesList[0]
      : branchesList[0]

    activeBranchId = selectedBranch.id
  } else if (!activeBranchId || !ctx.permissions.has('kitchen.view')) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <h2>Access Restricted</h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          You do not have permission to view the Kitchen Display.
        </p>
        <Link href="/" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>Return to Home</Link>
      </div>
    )
  }

  const queryClient = ctx.isSuperAdmin ? serviceSupabase : supabase
  const { data: activeOrders } = await queryClient
    .from('orders')
    .select('*, order_items(*)')
    .eq('branch_id', activeBranchId!)
    .in('fulfillment', ['pending', 'cooking', 'ready'])
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {(ctx.isSuperAdmin || (ctx.restaurantId && !ctx.branchId)) && (
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.5rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: '#0f172a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <Link
            href={ctx.isSuperAdmin ? '/super-admin/dashboard' : '/restaurant/dashboard'}
            style={{
              color: '#b45309',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ← Back to Admin Portal
          </Link>

          {branchesList.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Branch:</span>
              <form method="GET" style={{ margin: 0 }}>
                <select
                  name="branch"
                  defaultValue={activeBranchId!}
                  onChange={(e) => {
                    e.currentTarget.form?.submit()
                  }}
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    fontWeight: 500,
                  }}
                >
                  {branchesList.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </form>
            </div>
          )}

          <Link href="/staff/pos" style={{ color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
            🖥️ Open POS Terminal
          </Link>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <KitchenDisplay
          orders={activeOrders ?? []}
          branchId={activeBranchId!}
          canUpdate={canUpdate}
        />
      </div>
    </div>
  )
}
