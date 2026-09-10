import 'server-only'
import { configured } from '@/lib/env'
import { getMoveInContext as mock } from '@/lib/mock/east-ponds'
import type { MoveInContext } from '@/lib/types'

/**
 * The one place the app decides where move-in data comes from.
 *
 * Supabase when it's configured, mock otherwise. That's what lets the UX be
 * reviewed and demoed before any credential exists, and it means wiring the
 * backend is an env change rather than a code change.
 */
/**
 * The three demo properties are fixtures, not customers. No real community will
 * ever carry one of these slugs, so a Supabase miss on one of them means the
 * deployment is pointed at a database that has never heard of them — not that
 * a resident typed a bad URL.
 *
 * Falling back to mock here is what keeps a demo link alive when DEMO_MODE has
 * not reached the build. That failure has a nasty shape: /demo renders fine,
 * because it reads the fixtures directly, and only the walkthrough links 404 —
 * so it looks like a broken app rather than a missing environment variable,
 * and it surfaces while someone is presenting.
 */
const DEMO_SLUGS = new Set(['east-ponds', 'camp-creek', 'lyv-buckhead'])

export async function loadMoveInContext(
  slug: string,
  residentId?: string,
): Promise<MoveInContext | null> {
  if (!configured.supabase()) return mock(slug)

  let ctx: MoveInContext | null = null

  try {
    // Imported lazily so a build without Supabase env never pulls the client in.
    const { fetchMoveInContext } = await import('./supabase-source')
    ctx = await fetchMoveInContext(slug, residentId)
  } catch (err) {
    // A THROW is different from a miss, and the difference matters.
    //
    // A miss means the row isn't there. A throw means the query itself failed —
    // most often because the connected project has never had the move-in
    // migrations applied, so a column in the select doesn't exist. That is
    // exactly the state a demo deployment lands in when it inherits Supabase
    // credentials from an older site.
    //
    // For a demo fixture, fall back: a 500 on the screen you are presenting is
    // the worst outcome available. For a real property, rethrow — a database
    // outage must page someone, not quietly serve invented residents to a
    // person who is actually moving in.
    if (DEMO_SLUGS.has(slug)) {
      console.error(
        `[data] Supabase query failed for demo fixture "${slug}". Serving mock ` +
        `data so the demo stays usable. Set DEMO_MODE=1 on this deployment to ` +
        `skip Supabase entirely. Cause:`, err,
      )
      return mock(slug)
    }
    throw err
  }

  if (!ctx) {
    if (DEMO_SLUGS.has(slug)) {
      console.warn(
        `[data] "${slug}" is a demo fixture and Supabase has no such site. ` +
        `Serving mock data. If this is the demo deployment, set DEMO_MODE=1 ` +
        `so the data source is explicit rather than a fallback.`,
      )
      return mock(slug)
    }
    return null
  }

  // Merch comes from Shopify where it's configured; credential items never do,
  // because a fob has to be enrolled in Brivo against a named resident.
  //
  // A Shopify outage must not empty the store or block a move-in: on failure
  // the credential items still stand on their own.
  if (configured.shopify()) {
    try {
      const { fetchStoreProducts } = await import('@/lib/shopify')
      const merch = await fetchStoreProducts({ propertyHandle: slug })
      if (merch) {
        ctx.store = [
          ...ctx.store.filter(p => p.fulfilment === 'credential'),
          ...merch,
        ]
      }
    } catch (err) {
      console.error('[data] Shopify catalogue unavailable, showing credentials only', err)
    }
  }

  return ctx
}

export function dataSource(): 'supabase' | 'mock' {
  return configured.supabase() ? 'supabase' : 'mock'
}
