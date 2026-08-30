import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import { configured } from '@/lib/env'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['200', '300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  // While the app is on mock data it is a demo sitting on a real domain, and
  // it should not be indexed. This lifts itself the moment Supabase is
  // configured — no flag to remember to flip.
  robots: configured.supabase() ? undefined : { index: false, follow: false },
  title: 'GateCard',
  description: 'Move-in, access and services for your community.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GateCard',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#35455A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={montserrat.variable}>
      <body>{children}</body>
    </html>
  )
}
