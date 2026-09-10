import { notFound } from 'next/navigation'
import { loadMoveInContext } from '@/lib/data'
import { MoveInProvider } from './state'
import { SummaryRail } from '@/components/summary-rail'

/**
 * Loads the move-in context once, on the server, and holds it for all six
 * screens. Selections live in the provider too, so they survive navigation
 * between steps without a round trip.
 */
export default async function MoveInLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params
  const ctx = await loadMoveInContext(siteSlug)
  if (!ctx) notFound()
  // One column on a phone, two on a laptop. The rail is desktop-only and
  // purely reflective — see components/summary-rail.tsx.
  return (
    <MoveInProvider ctx={ctx}>
      <div className="mi-split">
        <div className="mi-split-flow">{children}</div>
        <SummaryRail />
      </div>
    </MoveInProvider>
  )
}
