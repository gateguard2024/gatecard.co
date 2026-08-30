import { notFound } from 'next/navigation'
import { getMoveInContext } from '@/lib/mock/east-ponds'
import { PropertyHeader, GateGuardMark } from '@/components/chrome'

/**
 * Property shell. The accent is injected here as a CSS variable, so every
 * chromatic thing downstream reads --accent and nothing hardcodes gold.
 * Swapping to a real sites row means changing getMoveInContext, nothing else.
 */
export default async function PropertyLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params
  const ctx = getMoveInContext(siteSlug)
  if (!ctx) notFound()

  return (
    <div
      className="mi-shell"
      data-property={ctx.property.slug}
      style={{ ['--accent' as string]: ctx.property.accent }}
    >
      <PropertyHeader property={ctx.property} />
      {children}
      <GateGuardMark />
    </div>
  )
}
