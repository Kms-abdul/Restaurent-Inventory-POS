import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'
import RestaurantAdminNav from '@/components/restaurant/RestaurantAdminNav'

export default async function RestaurantAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext()

  if (!ctx) redirect('/login')
  if (!ctx.restaurantId || ctx.isSuperAdmin) redirect('/')

  return (
    <div className="ra-root">
      <RestaurantAdminNav
        profile={ctx.profile}
        restaurant={ctx.restaurant!}
      />
      <main className="ra-main">{children}</main>
    </div>
  )
}
