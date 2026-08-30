import { notFound } from 'next/navigation'
import { loadMoveInContext, dataSource } from '@/lib/data'
import { PropertyHeader, GateGuardMark } from '@/components/chrome'

/**
 * Property shell. The accent is injected here as a CSS variable, so every
 * chromatic thing downstream reads --accent and nothing hardcodes gold.
 * The data layer decides mock vs Supabase; nothing here knows which.
 */
export default async function PropertyLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params
  const ctx = await loadMoveInContext(siteSlug)
  if (!ctx) notFound()

  return (
    <div
      className="mi-shell"
      data-property={ctx.property.slug}
      style={{ ['--accent' as string]: ctx.property.accent }}
    >
      {dataSource() === 'mock' && (
        <div className="mi-demo">
          Demo · invented residents, no payments taken
        </div>
      )}
      <PropertyHeader property={ctx.property} />
      {children}
      <GateGuardMark />
    </div>
  )
}
