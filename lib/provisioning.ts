import 'server-only'
import { supabaseAdmin } from './supabase'

/**
 * The provisioning queue (D8).
 *
 * Idempotent, retriable, and readable by the leasing office — that last one is
 * the requirement people forget. When a resident says "my key doesn't work",
 * someone at the property has to be able to see why without calling us.
 *
 * The queue row is written first and the worker runs after. If Inngest is down,
 * unconfigured, or the deploy is mid-rollout, the intent is still recorded and
 * gets picked up later. Nothing is lost because a background service blinked.
 */

export type JobKind =
  | 'brivo_credential'
  | 'fob_enroll'
  | 'parking_assign'
  | 'gatecard_issue'
  | 'welcome_message'
  | 'service_order'
  | 'shopify_order'

export interface EnqueueArgs {
  kind: JobKind
  siteId: string
  residentId?: string
  orderItemId?: string
  payload?: Record<string, unknown>
  /**
   * Must be derived from what the job DOES, never from when it ran. A retried
   * webhook and a replayed event have to collide here — that collision is the
   * thing standing between a resident and two Brivo credentials.
   */
  idempotencyKey: string
}

export async function enqueue(job: EnqueueArgs): Promise<{ id: string; created: boolean }> {
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('provisioning_jobs')
    .upsert(
      {
        idempotency_key: job.idempotencyKey,
        kind: job.kind,
        site_id: job.siteId,
        resident_id: job.residentId ?? null,
        order_item_id: job.orderItemId ?? null,
        payload: job.payload ?? {},
        status: 'queued',
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (error) throw error

  if (data?.id) return { id: data.id as string, created: true }

  // Already queued by an earlier attempt — that is a success, not a failure.
  const { data: existing, error: findErr } = await db
    .from('provisioning_jobs')
    .select('id')
    .eq('idempotency_key', job.idempotencyKey)
    .single()
  if (findErr) throw findErr
  return { id: existing.id as string, created: false }
}

export async function markRunning(id: string) {
  const db = supabaseAdmin()
  await db.from('provisioning_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', id)
}

export async function markSucceeded(id: string) {
  const db = supabaseAdmin()
  await db.from('provisioning_jobs')
    .update({ status: 'succeeded', completed_at: new Date().toISOString() })
    .eq('id', id)
}

export async function markFailed(id: string, err: unknown, attempts: number) {
  const db = supabaseAdmin()
  await db.from('provisioning_jobs')
    .update({
      status: 'failed',
      last_error: err instanceof Error ? err.message : String(err),
      attempts,
    })
    .eq('id', id)
}

/**
 * What the leasing office sees. Ordered so anything stuck surfaces first —
 * a screen that leads with successes is a screen nobody opens.
 */
export async function siteQueue(siteId: string) {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('provisioning_jobs')
    .select('id, kind, status, attempts, last_error, created_at, completed_at, resident_id')
    .eq('site_id', siteId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}
