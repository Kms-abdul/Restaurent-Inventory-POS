import { redirect } from 'next/navigation'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { getPortalType } from '@/types/database'

/**
 * Root page — dispatches to the correct portal based on the user's role.
 * Middleware already handles the unauthenticated → /login redirect.
 * getUserContext returns null on DB errors (schema not applied) → redirect to login.
 */
export default async function RootPage() {
  let ctx = null
  try {
    ctx = await getUserContext()
  } catch {
    redirect('/login')
  }

  if (!ctx) {
    redirect('/login')
  }

  const portal = getPortalType(ctx)

  switch (portal) {
    case 'super_admin':
      redirect('/super-admin/dashboard')
    case 'restaurant_admin':
      redirect('/restaurant/dashboard')
    case 'branch_staff':
      if (ctx.permissions.has('kitchen.view') && !ctx.permissions.has('pos.create_order')) {
        redirect('/staff/kitchen')
      }
      redirect('/staff/pos')
    default:
      // Logged in but no membership assigned
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 800, color: '#0f172a' }}>No Access</h1>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontWeight: 500 }}>You haven&apos;t been assigned to any restaurants or branches yet.</p>
          <form action={async () => {
            'use server'
            const supabase = await createClient()
            await supabase.auth.signOut()
            redirect('/login')
          }}>
            <button style={{ padding: '0.75rem 1.5rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              Sign Out
            </button>
          </form>
        </div>
      )
  }
}
