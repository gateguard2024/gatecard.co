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
  return fetchMoveInContext(slug, residentId)
}

export function dataSource(): 'supabase' | 'mock' {
  return configured.supabase() ? 'supabase' : 'mock'
}
