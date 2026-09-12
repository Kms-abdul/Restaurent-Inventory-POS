import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext()

  if (!ctx) redirect('/login')

  // Allow Super Admin, Restaurant Admin, or Branch Staff to access /staff routes
  if (!ctx.isSuperAdmin && !ctx.restaurantId && !ctx.branchId) {
    redirect('/')
  }

  return (
    <div className="pos-root">
      {children}
    </div>
  )
}

