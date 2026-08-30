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
export async function loadMoveInContext(
  slug: string,
  residentId?: string,
): Promise<MoveInContext | null> {
  if (!configured.supabase()) return mock(slug)

  // Imported lazily so a build without Supabase env never pulls the client in.
  const { fetchMoveInContext } = await import('./supabase-source')
  const ctx = await fetchMoveInContext(slug, residentId)
  if (!ctx) return null

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
