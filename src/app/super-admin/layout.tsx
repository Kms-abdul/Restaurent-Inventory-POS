import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'
import SuperAdminNav from '@/components/super-admin/SuperAdminNav'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext()

  if (!ctx || !ctx.isSuperAdmin) {
    redirect('/login?error=unauthorized')
  }

  return (
    <div className="sa-root">
      <SuperAdminNav profile={ctx.profile} />
      <main className="sa-main">{children}</main>
    </div>
  )
}
