import { redirect } from 'next/navigation'
import { getUserContext } from '@/utils/supabase/server'

export const metadata = { title: 'Settings — Super Admin' }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]

export default async function SettingsPage() {
  const ctx = await getUserContext()
  if (!ctx?.isSuperAdmin) redirect('/')

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1 style={{ color: '#0f172a' }}>Platform Settings</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            System-level configuration and infrastructure information
          </p>
        </div>
      </div>

      {/* Platform Info */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Platform Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Supabase Project', value: projectRef, mono: true },
            { label: 'Environment', value: process.env.NODE_ENV ?? 'development' },
            { label: 'Region', value: 'ap-south-1 (India)' },
            { label: 'Platform Version', value: '2.0.0 (Multi-tenant)' },
          ].map(item => (
            <div key={item.label} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontFamily: item.mono ? 'monospace' : undefined, fontSize: item.mono ? '0.85rem' : '0.95rem', color: '#0f172a', fontWeight: 600 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Supabase Console Links</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {[
            { label: '🗄️  Database Tables',    href: `https://supabase.com/dashboard/project/${projectRef}/editor` },
            { label: '🔐  Auth Users',           href: `https://supabase.com/dashboard/project/${projectRef}/auth/users` },
            { label: '🔒  RLS Policies',         href: `https://supabase.com/dashboard/project/${projectRef}/auth/policies` },
            { label: '📡  Realtime Logs',        href: `https://supabase.com/dashboard/project/${projectRef}/logs/realtime-logs` },
            { label: '📊  API Logs',             href: `https://supabase.com/dashboard/project/${projectRef}/logs/api-gateway` },
            { label: '🗃️  SQL Editor',           href: `https://supabase.com/dashboard/project/${projectRef}/sql/new` },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Print Agent Setup Guide */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>🖨️ Print Agent Setup</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          The Print Agent is a local Windows app that runs on each restaurant&apos;s PC and connects to Supabase to pull print jobs.
          Each branch needs to have the agent installed and configured.
        </p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {[
            { step: '1', title: 'Download & Install', desc: 'Copy the print-agent/ folder to the restaurant PC. Run npm install inside it.' },
            { step: '2', title: 'Configure .env',     desc: 'Create a .env file with SUPABASE_URL, SUPABASE_SERVICE_KEY, BRANCH_ID, and the Windows printer names.' },
            { step: '3', title: 'Register Printers',  desc: 'Go to Restaurants → Manage → and add the Windows printer names for each branch.' },
            { step: '4', title: 'Start Agent',        desc: 'Run npm start or use pm2 for auto-start on Windows boot.' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '32px', height: '32px', background: '#2563eb', color: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                {s.step}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{s.title}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="sa-section" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>🔐 Security Checklist</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { ok: true,  text: 'Row Level Security (RLS) enabled on all tables' },
            { ok: true,  text: 'SECURITY DEFINER RPC functions for sensitive operations' },
            { ok: true,  text: 'Service Role Key only used server-side (never exposed to browser)' },
            { ok: true,  text: 'Multi-tenant data isolation — every query scoped to restaurant/branch' },
            { ok: false, text: 'SSL/HTTPS (enable before going to production)' },
            { ok: false, text: 'Custom domain configured on Vercel' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.875rem' }}>
              <span style={{ fontSize: '1rem' }}>{item.ok ? '✅' : '⚠️'}</span>
              <span style={{ color: item.ok ? '#16a34a' : '#d97706', fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
