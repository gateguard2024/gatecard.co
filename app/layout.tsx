import type { Metadata, Viewport } from 'next'
import { Montserrat, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { configured, demoMode } from '@/lib/env'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['200', '300', '400', '500', '600', '700'],
  display: 'swap',
})

/**
 * The display face, for headlines and for money.
 *
 * A hotel lobby does not set its signage in the same face as its fire-exit
 * notices. One restrained serif on the six or seven moments that matter —
 * the greeting, the section heads, the amount due — is what separates a
 * portal that feels considered from one that feels like a form. Everything
 * functional stays in Montserrat, where legibility at 12px matters more than
 * character.
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  // While the app is on mock data it is a demo sitting on a real domain, and
  // it should not be indexed. This lifts itself the moment Supabase is
  // configured — no flag to remember to flip.
  robots: configured.supabase() && !demoMode()
    ? undefined
    : { index: false, follow: false },
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
  themeColor: '#1B2430',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
          className={`${montserrat.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  )
}
