import type { Metadata } from 'next'
import './globals.css'
import PageLoader from '@/components/ui/PageLoader'

// Force all routes to be dynamically rendered at request time.
// Required because every page uses cookies() for Supabase auth.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Restaurant POS Platform',
  description: 'Multi-tenant restaurant management and point-of-sale platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PageLoader />
        {children}
      </body>
    </html>
  )
}

