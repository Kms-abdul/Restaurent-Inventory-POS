import type { Metadata, Viewport } from 'next'
import './globals.css'
import PageLoader from '@/components/ui/PageLoader'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt'

// Force all routes to be dynamically rendered at request time.
// Required because every page uses cookies() for Supabase auth.
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a7a4c',
}

export const metadata: Metadata = {
  title: 'Kitchora - Restaurant Operations Platform',
  description: 'Multi-tenant restaurant management and point-of-sale platform - Inventory, POS, Recipes & More',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kitchora',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-96x96.png" />

        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <PWAInstallPrompt />
        <PageLoader />
        {children}
      </body>
    </html>
  )
}

