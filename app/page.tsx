import { redirect } from 'next/navigation'

// Root — redirect to demo property for now
// Sprint 2: replace with lead capture landing page at gateguard.co
export default function RootPage() {
  redirect('/parkview-demo')
}
