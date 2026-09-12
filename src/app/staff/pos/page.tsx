import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient, createServiceClient } from '@/utils/supabase/server'
import POSTerminal from '@/components/pos/POSTerminal'

export const metadata = { title: 'POS Terminal — Point of Sale' }

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; restaurant?: string }>
}) {
  const { branch: requestedBranchId, restaurant: requestedRestaurantId } = await searchParams
  const ctx = await getUserContext()

  if (!ctx) redirect('/login')

  const serviceSupabase = await createServiceClient()
  const supabase = await createClient()

  // Determine branch, restaurant and permissions
  let activeBranchId: string | null = ctx.branchId
  let activeRestaurantId: string | null = ctx.restaurantId
  let restaurantName = ctx.restaurant?.name || ''
  let branchName = ctx.branch?.name || ''
  let canVoid = ctx.permissions.has('pos.void_order')
  let canDiscount = ctx.permissions.has('pos.apply_discount')
  let roleName = 'Cashier'
  let branchesData: { id: string; name: string }[] = []

  if (ctx.isSuperAdmin) {
    roleName = 'Super Admin'
    canVoid = true
    canDiscount = true

    // Fetch all active restaurants
    const { data: allRestaurants } = await serviceSupabase
      .from('restaurants')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (!allRestaurants || allRestaurants.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Restaurants Found</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Please create an active restaurant first.
          </p>
          <Link href="/super-admin/restaurants/new" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>+ Create Restaurant</Link>
        </div>
      )
    }

    const selectedRestaurant = requestedRestaurantId
      ? allRestaurants.find(r => r.id === requestedRestaurantId) ?? allRestaurants[0]
      : allRestaurants[0]

    activeRestaurantId = selectedRestaurant.id
    restaurantName = selectedRestaurant.name

    // Fetch all branches for this restaurant
    const { data: branches } = await serviceSupabase
      .from('branches')
      .select('id, name')
      .eq('restaurant_id', activeRestaurantId)
      .eq('is_active', true)
      .order('name')

    branchesData = branches ?? []

    if (branchesData.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Branches Found for {restaurantName}</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Please create an active branch before taking orders at POS.
          </p>
          <Link href="/restaurant/branches/new" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>+ Create Branch</Link>
        </div>
      )
    }

    const selectedBranch = requestedBranchId
      ? branchesData.find(b => b.id === requestedBranchId) ?? branchesData[0]
      : branchesData[0]

    activeBranchId = selectedBranch.id
    branchName = selectedBranch.name
  } else if (ctx.restaurantId && !ctx.branchId) {
    // Restaurant Admin
    activeRestaurantId = ctx.restaurantId
    restaurantName = ctx.restaurant?.name || 'Restaurant'
    roleName = 'Restaurant Admin'
    canVoid = true
    canDiscount = true

    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('restaurant_id', activeRestaurantId)
      .eq('is_active', true)
      .order('name')

    branchesData = branches ?? []

    if (branchesData.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>No Active Branches Found</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Please create an active branch before taking orders at POS.
          </p>
          <Link href="/restaurant/branches/new" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>+ Create Branch</Link>
        </div>
      )
    }

    const selectedBranch = requestedBranchId
      ? branchesData.find(b => b.id === requestedBranchId) ?? branchesData[0]
      : branchesData[0]

    activeBranchId = selectedBranch.id
    branchName = selectedBranch.name
  } else if (activeBranchId) {
    // Branch Staff
    roleName = 'Cashier'
    restaurantName = ctx.restaurant?.name || 'Restaurant'
    branchName = ctx.branch?.name || 'Main Branch'
    branchesData = [{ id: activeBranchId, name: branchName }]

    if (!ctx.permissions.has('pos.create_order')) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <h2>Access Restricted</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            You do not have permission to access the POS terminal. Please contact your manager.
          </p>
          <Link href="/" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>Return to Dashboard</Link>
        </div>
      )
    }
  } else {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <h2>No Branch Assigned</h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          You do not have an active branch assigned. Please contact your administrator.
        </p>
        <Link href="/" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 600 }}>Return to Dashboard</Link>
      </div>
    )
  }

  // Load menu categories for this restaurant
  const queryClient = ctx.isSuperAdmin ? serviceSupabase : supabase
  const { data: categories } = await queryClient
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('restaurant_id', activeRestaurantId!)
    .eq('is_active', true)
    .order('sort_order')

  // Load menu items with branch assignment checks
  const { data: allMenuItems } = await queryClient
    .from('menu_items')
    .select(`
      id, name, price, category_id, image_url, is_available,
      branch_menu_items ( branch_id, is_available )
    `)
    .eq('restaurant_id', activeRestaurantId!)
    .eq('is_active', true)
    .order('name')

  // Branch-specific filtering:
  // If an item has branch_menu_items, only show it if assigned to activeBranchId with is_available: true.
  // If no branch_menu_items exist, it is a global item.
  const filteredMenuItems = (allMenuItems ?? []).filter((item: any) => {
    const overrides = item.branch_menu_items ?? []
    if (overrides.length === 0) return item.is_available !== false
    const branchEntry = overrides.find((b: any) => b.branch_id === activeBranchId)
    if (!branchEntry) return false // Not assigned to this branch!
    return branchEntry.is_available === true
  }).map((item: any) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    category_id: item.category_id,
    image_url: item.image_url,
    is_available: item.is_available,
  }))

  return (
    <POSTerminal
      branchId={activeBranchId!}
      restaurantId={activeRestaurantId!}
      cashierName={ctx.profile?.name || 'Staff'}
      roleName={roleName}
      branchName={branchName}
      restaurantName={restaurantName}
      branches={branchesData}
      categories={categories ?? []}
      menuItems={filteredMenuItems}
      canVoid={canVoid}
      canDiscount={canDiscount}
      isAdmin={ctx.isSuperAdmin || !!ctx.restaurantId}
    />
  )
}
