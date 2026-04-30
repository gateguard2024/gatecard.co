import { redirect } from 'next/navigation'

// Root redirect — in production, QR codes point to /[siteSlug] directly.
// This just handles bare gatecard.co visits.
export default function RootPage() {
  redirect('/parkview-demo')
}
