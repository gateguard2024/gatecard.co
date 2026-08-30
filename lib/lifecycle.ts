import 'server-only'
import crypto from 'node:crypto'
import { supabaseAdmin } from './supabase'
import { getToken, toE164, type BrivoCredentials } from './brivo'
import {
  reconcile, summarise,
  type KnownResident, type RosterEntry, type Policy, type Reconciliation,
} from './reconcile'
import { sendEmail, staffDigestHtml, residentInviteHtml, type MoveInRow } from './notify'
import { getUnitMap, type UnitSource } from './brivo-topology'

/**
 * One site's roster sync, end to end: fetch → reconcile → apply → notify.
 *
 * The reconciler decides; this applies. Keeping the decision pure is what makes
 * the dangerous cases (mass move-out, flapping, re-entry) testable without a
 * Brivo account.
 */

const API_URL = 'https://api.brivo.com/v1/api'

export interface SiteSyncConfig {
  id: string
  slug: string | null
  name: string
  accent_color: string | null
  leasing_phone: string | null
  pm_email: string | null
  primary_contact_email: string | null
  ops_email: string | null
  brivo_sync_mode: 'off' | 'baseline' | 'live'
  auto_invite_residents: boolean
  move_out_confirm_runs: number
  move_out_grace_hours: number
  roster_shrink_guard_pct: number
  brivo_unit_field: string | null
  brivo_unit_source: UnitSource
  brivo_unit_pattern: string | null
  brivo_unit_exclude: string[] | null
  brivo_topology_ttl_minutes: number
  brivo_auth_basic: string | null
  brivo_api_key: string | null
  brivo_username: string | null
  brivo_password: string | null
}

/**
 * Fetch every page, and say plainly whether we got them all.
 *
 * `complete` is the single most important value this returns. The previous
 * implementation had no equivalent: it treated a half-fetched roster exactly
 * like a full one and deactivated the difference.
 *
 * Units are NOT resolved here. At these properties a unit is a Brivo site, and
 * that relationship runs through groups rather than sitting on the user — see
 * lib/brivo-topology.ts. Only the custom-field case can be read inline.
 */
export async function fetchRoster(
  creds: BrivoCredentials,
  unitField: string,
): Promise<{ roster: RosterEntry[]; pages: number; complete: boolean; error?: string }> {
  const token = await getToken(creds)
  const roster: RosterEntry[] = []
  const pageSize = 100
  let pages = 0

  try {
    for (let offset = 0; ; offset += pageSize) {
      const res = await fetch(`${API_URL}/users?pageSize=${pageSize}&offset=${offset}`, {
        headers: { Authorization: `bearer ${token}`, 'api-key': creds.apiKey.trim() },
        cache: 'no-store',
      })
      if (!res.ok) {
        return { roster, pages, complete: false, error: `Brivo ${res.status} at offset ${offset}` }
      }

      const json = (await res.json()) as Record<string, unknown>
      // Brivo has returned this under different keys across accounts and
      // versions; the archived sync already had to defend against it.
      const page = (json.users ?? json.data ?? json.results ?? []) as {
        id: number | string
        firstName?: string
        lastName?: string
        email?: string
        phoneNumbers?: { number: string }[]
        customFields?: { fieldName: string; fieldValue: string }[]
      }[]

      if (!Array.isArray(page)) {
        return { roster, pages, complete: false, error: 'Unrecognised Brivo response shape' }
      }
      pages += 1

      for (const u of page) {
        if (!u.id) continue
        roster.push({
          brivoUserId: String(u.id),
          // Full names, deliberately. The old sync stored the last name as an
          // initial for intercom privacy, which destroyed the real value — a
          // lease-facing portal needs the actual name.
          firstName: (u.firstName ?? '').trim(),
          lastName: (u.lastName ?? '').trim(),
          email: u.email?.trim() || null,
          phone: toE164(u.phoneNumbers?.[0]?.number),
          unitNumber:
            u.customFields?.find(f =>
              f.fieldName?.toLowerCase() === unitField.toLowerCase())?.fieldValue?.trim() || null,
        })
      }

      if (page.length < pageSize) break
      // Runaway guard: 200 pages is 20,000 users, far past any single property.
      if (pages > 200) return { roster, pages, complete: false, error: 'Pagination did not terminate' }
    }
    return { roster, pages, complete: true }
  } catch (err) {
    return { roster, pages, complete: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function inviteUrl(token: string, slug: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gatecard.co'
  return `${base}/${slug ?? ''}/move-in?invite=${token}`
}

export async function syncSite(site: SiteSyncConfig): Promise<{
  runId: string
  summary: string
  reconciliation?: Reconciliation
}> {
  const db = supabaseAdmin()
  const now = new Date()

  const { data: run } = await db.from('brivo_sync_runs')
    .insert({ site_id: site.id, mode: site.brivo_sync_mode, status: 'running' })
    .select('id').single()
  const runId = run!.id as string

  const finish = async (patch: Record<string, unknown>) => {
    await db.from('brivo_sync_runs')
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq('id', runId)
  }

  if (!site.brivo_auth_basic || !site.brivo_api_key || !site.brivo_username || !site.brivo_password) {
    await finish({ status: 'failed', error: 'Site has no Brivo credentials' })
    return { runId, summary: 'No Brivo credentials on this site' }
  }

  const fetched = await fetchRoster(
    {
      authBasic: site.brivo_auth_basic,
      apiKey: site.brivo_api_key,
      username: site.brivo_username,
      password: site.brivo_password,
    },
    site.brivo_unit_field ?? 'Unit',
  )

  // ── Units ──────────────────────────────────────────────────────────────────
  // A unit is a Brivo site here, reachable only via group membership, so it is
  // resolved from the cached topology rather than read off the user.
  const unitAttention: string[] = []

  if (site.brivo_unit_source !== 'custom_field' && fetched.roster.length) {
    const unit = await getUnitMap({
      propertySiteId: site.id,
      creds: {
        authBasic: site.brivo_auth_basic,
        apiKey: site.brivo_api_key,
        username: site.brivo_username,
        password: site.brivo_password,
      },
      cfg: {
        source: site.brivo_unit_source,
        pattern: site.brivo_unit_pattern,
        exclude: site.brivo_unit_exclude ?? [],
      },
      ttlMinutes: site.brivo_topology_ttl_minutes ?? 360,
      expectUserIds: fetched.roster.map(r => r.brivoUserId),
    })

    for (const entry of fetched.roster) {
      const resolved = unit.map[entry.brivoUserId]
      // Only ever fill a unit in. Never blank one that is already known because
      // this run couldn't resolve it — that would read as a unit change.
      if (resolved) entry.unitNumber = resolved
    }

    const ambiguous = Object.keys(unit.ambiguous).length
    if (ambiguous) {
      unitAttention.push(
        `${ambiguous} resident${ambiguous === 1 ? '' : 's'} match more than one unit in Brivo ` +
        `and were left without one. Usually a stale permission from a previous unit, ` +
        `or a unit pattern that is too loose.`)
    }
    if (!unit.complete) {
      unitAttention.push(
        `Unit lookup did not complete${unit.error ? ` (${unit.error})` : ''}. ` +
        `Existing units were kept; new residents may arrive without one.`)
    }
    if (unit.complete && unit.unitNames.length === 0) {
      unitAttention.push(
        `No Brivo site looked like a unit. Check sites.brivo_unit_pattern against ` +
        `the real names — run /api/brivo/probe?siteSlug=${site.slug ?? ''} to see them.`)
    }
  }

  const { data: knownRows, error: knownErr } = await db
    .from('residents')
    .select('id, brivo_user_id, unit_number, lifecycle_status, missing_since, missing_streak')
    .eq('site_id', site.id)
    .not('brivo_user_id', 'is', null)
    .returns<{
      id: string; brivo_user_id: string; unit_number: string | null
      lifecycle_status: string; missing_since: string | null; missing_streak: number
    }[]>()
  if (knownErr) {
    await finish({ status: 'failed', error: knownErr.message })
    return { runId, summary: `Could not load residents: ${knownErr.message}` }
  }

  const known: KnownResident[] = (knownRows ?? []).map(r => ({
    id: r.id,
    brivoUserId: r.brivo_user_id,
    unitNumber: r.unit_number,
    lifecycleStatus: r.lifecycle_status as KnownResident['lifecycleStatus'],
    missingSince: r.missing_since,
    missingStreak: r.missing_streak ?? 0,
  }))

  const policy: Policy = {
    mode: site.brivo_sync_mode === 'baseline' ? 'baseline' : 'live',
    confirmRuns: site.move_out_confirm_runs,
    graceHours: site.move_out_grace_hours,
    shrinkGuardPct: Number(site.roster_shrink_guard_pct),
  }

  const r = reconcile({
    known, roster: fetched.roster, policy, fetchComplete: fetched.complete, now,
  })
  const summary = summarise(r)

  // ── Guarded: record what we saw, change nothing, tell a human ──────────────
  if (r.guard) {
    await finish({
      status: 'guarded',
      guard_reason: `${r.guard.reason}: ${r.guard.detail}`,
      error: fetched.error ?? null,
      pages_fetched: fetched.pages,
      fetch_complete: fetched.complete,
      roster_count: r.rosterCount,
      previous_count: r.previousCount,
    })
    await db.from('resident_lifecycle_events').insert({
      site_id: site.id, run_id: runId, kind: 'flagged',
      detail: r.guard.detail, payload: { reason: r.guard.reason },
    })
    await notifyStaff(site, runId, { movedIn: [], movedOut: [], unitChanged: [] }, r.guard.detail, [])
    return { runId, summary, reconciliation: r }
  }

  const nowIso = now.toISOString()

  // ── Apply: present residents ───────────────────────────────────────────────
  for (const { known: k, entry } of [...r.seen, ...r.returned]) {
    await db.from('residents').update({
      first_name: entry.firstName || undefined,
      last_name: entry.lastName || undefined,
      email: entry.email,
      phone: entry.phone,
      // Never blank a unit we already have because Brivo omitted it this run.
      ...(entry.unitNumber ? { unit_number: entry.unitNumber } : {}),
      last_seen_at: nowIso,
      missing_since: null,
      missing_streak: 0,
      lifecycle_status: 'current',
      active: true,
      last_synced_at: nowIso,
    }).eq('id', k.id)
  }

  // ── Move-ins ───────────────────────────────────────────────────────────────
  const movedInRows: MoveInRow[] = []
  const attention: string[] = [...unitAttention]

  for (const entry of r.movedIn) {
    const { data: resident, error } = await db.from('residents').insert({
      site_id: site.id,
      brivo_user_id: entry.brivoUserId,
      first_name: entry.firstName || '(Unknown)',
      last_name: entry.lastName,
      email: entry.email,
      phone: entry.phone,
      unit_number: entry.unitNumber,
      active: true,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      last_synced_at: nowIso,
      lifecycle_status: 'current',
    }).select('id').single()
    if (error || !resident) continue

    const tenancy = await openTenancy(site.id, resident.id as string, entry.unitNumber)

    // Baseline adopts the existing roster without treating it as arrivals.
    if (r.baseline) continue

    await db.from('resident_lifecycle_events').insert({
      site_id: site.id, resident_id: resident.id, tenancy_id: tenancy, run_id: runId,
      kind: 'moved_in', detail: entry.unitNumber ? `Unit ${entry.unitNumber}` : 'Unit unknown',
      payload: { brivoUserId: entry.brivoUserId },
    })

    const token = crypto.randomBytes(24).toString('base64url')
    await db.from('move_in_invites').insert({
      site_id: site.id, resident_id: resident.id, tenancy_id: tenancy, token,
      expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    })

    if (!entry.unitNumber) {
      attention.push(`${entry.firstName} ${entry.lastName} has no unit number in Brivo — ` +
                     `they cannot be sent a parking registration until it's set.`)
    }
    if (!entry.email && !entry.phone) {
      attention.push(`${entry.firstName} ${entry.lastName} has no email or phone in Brivo — ` +
                     `their link has to be handed over at the leasing office.`)
    }

    movedInRows.push({
      firstName: entry.firstName, lastName: entry.lastName,
      unitNumber: entry.unitNumber, email: entry.email, phone: entry.phone,
      inviteUrl: inviteUrl(token, site.slug),
    })

    // The resident's own email is gated per property. Auto-mailing real people
    // off a roster nobody has watched yet is a one-time mistake.
    if (site.auto_invite_residents && entry.email && entry.unitNumber) {
      await sendEmail({
        idempotencyKey: `invite:${tenancy}`,
        to: entry.email,
        kind: 'resident_move_in_invite',
        siteId: site.id,
        residentId: resident.id as string,
        subject: `Register your parking and gate access at ${site.name}`,
        replyTo: site.pm_email ?? site.primary_contact_email ?? undefined,
        html: residentInviteHtml({
          propertyName: site.name,
          accent: site.accent_color ?? '#6CABD4',
          firstName: entry.firstName,
          unitNumber: entry.unitNumber,
          inviteUrl: inviteUrl(token, site.slug),
          leasingPhone: site.leasing_phone,
        }),
      })
      await db.from('move_in_invites')
        .update({ sent_to: entry.email, sent_at: nowIso })
        .eq('token', token)
    }
  }

  // ── Returned — a fresh tenancy, treated like a move-in ─────────────────────
  for (const { known: k, entry } of r.returned) {
    const tenancy = await openTenancy(site.id, k.id, entry.unitNumber)
    await db.from('resident_lifecycle_events').insert({
      site_id: site.id, resident_id: k.id, tenancy_id: tenancy, run_id: runId,
      kind: 'returned', detail: entry.unitNumber ? `Unit ${entry.unitNumber}` : null,
    })
    movedInRows.push({
      firstName: entry.firstName, lastName: entry.lastName,
      unitNumber: entry.unitNumber, email: entry.email, phone: entry.phone,
      inviteUrl: null,
    })
  }

  // ── Unit changes — parking follows, credential does not change ─────────────
  for (const u of r.unitChanged) {
    await db.from('residents').update({ unit_number: u.to }).eq('id', u.known.id)
    await db.from('resident_tenancies')
      .update({ unit_number: u.to })
      .eq('resident_id', u.known.id).eq('status', 'active')
    await db.from('resident_lifecycle_events').insert({
      site_id: site.id, resident_id: u.known.id, run_id: runId,
      kind: 'unit_changed', detail: `${u.from ?? '—'} → ${u.to}`,
    })
  }

  // ── Pending move-outs — counted, not acted on ──────────────────────────────
  for (const m of r.markMissing) {
    await db.from('residents').update({
      missing_since: m.missingSince,
      missing_streak: m.streak,
      lifecycle_status: 'pending_move_out',
    }).eq('id', m.known.id)
  }

  // ── Confirmed move-outs ────────────────────────────────────────────────────
  const movedOutRows: { firstName: string; lastName: string; unitNumber: string | null }[] = []

  for (const m of r.movedOut) {
    const { data: person } = await db.from('residents')
      .select('first_name, last_name, unit_number')
      .eq('id', m.known.id).maybeSingle()

    await db.from('residents').update({
      lifecycle_status: 'moved_out',
      active: false,
      missing_since: null,
      missing_streak: 0,
    }).eq('id', m.known.id)

    const { data: tenancy } = await db.from('resident_tenancies')
      .update({ status: 'ended', moved_out_at: nowIso })
      .eq('resident_id', m.known.id).eq('status', 'active')
      .select('id').maybeSingle()

    // Billing must not outlive the tenancy. This is the failure everyone
    // predicts and nobody catches: a card still being charged monthly for a
    // parking space at an apartment the person left in March.
    await db.from('resident_subscriptions')
      .update({ status: 'ended', ended_at: nowIso })
      .eq('resident_id', m.known.id).eq('status', 'active')

    // Release the space, or availability rots and covered parking can never
    // be resold.
    await db.from('parking_assignments')
      .update({ status: 'released', released_at: nowIso })
      .eq('resident_id', m.known.id).eq('status', 'active')

    // A live move-in link for someone who has left is a way into the portal.
    await db.from('move_in_invites')
      .update({ revoked_at: nowIso })
      .eq('resident_id', m.known.id).is('revoked_at', null)

    await db.from('provisioning_jobs')
      .update({ status: 'cancelled' })
      .eq('resident_id', m.known.id).eq('status', 'queued')

    await db.from('resident_lifecycle_events').insert({
      site_id: site.id, resident_id: m.known.id, tenancy_id: tenancy?.id ?? null,
      run_id: runId, kind: 'moved_out',
      detail: `Absent since ${m.absentSince}`,
    })

    movedOutRows.push({
      firstName: person?.first_name ?? '', lastName: person?.last_name ?? '',
      unitNumber: person?.unit_number ?? null,
    })
  }

  await finish({
    status: 'completed',
    pages_fetched: fetched.pages,
    fetch_complete: fetched.complete,
    roster_count: r.rosterCount,
    previous_count: r.previousCount,
    moved_in_count: r.baseline ? 0 : r.movedIn.length,
    moved_out_count: r.movedOut.length,
    unit_changed_count: r.unitChanged.length,
    returned_count: r.returned.length,
  })

  // Baseline is silent by design.
  if (!r.baseline && (movedInRows.length || movedOutRows.length || r.unitChanged.length)) {
    await notifyStaff(site, runId, {
      movedIn: movedInRows,
      movedOut: movedOutRows,
      unitChanged: r.unitChanged.map(u => ({
        firstName: u.entry.firstName, lastName: u.entry.lastName, from: u.from, to: u.to,
      })),
    }, null, attention)
  }

  return { runId, summary, reconciliation: r }
}

async function openTenancy(
  siteId: string, residentId: string, unit: string | null,
): Promise<string | null> {
  const db = supabaseAdmin()
  const { count } = await db.from('resident_tenancies')
    .select('id', { count: 'exact', head: true })
    .eq('resident_id', residentId).eq('site_id', siteId)

  const { data } = await db.from('resident_tenancies').insert({
    site_id: siteId, resident_id: residentId, unit_number: unit,
    status: 'active', sequence: (count ?? 0) + 1,
  }).select('id').maybeSingle()
  return (data?.id as string) ?? null
}

async function notifyStaff(
  site: SiteSyncConfig,
  runId: string,
  rows: {
    movedIn: MoveInRow[]
    movedOut: { firstName: string; lastName: string; unitNumber: string | null }[]
    unitChanged: { firstName: string; lastName: string; from: string | null; to: string }[]
  },
  guard: string | null,
  attention: string[],
) {
  const to = site.pm_email ?? site.primary_contact_email ?? site.ops_email
             ?? process.env.OPS_EMAIL ?? null
  if (!to) return

  const n = rows.movedIn.length + rows.movedOut.length
  const subject = guard
    ? `${site.name} — resident sync needs a look`
    : `${site.name} — ${n} resident change${n === 1 ? '' : 's'}`

  await sendEmail({
    // One digest per run, so a retried run cannot re-send it.
    idempotencyKey: `digest:${runId}`,
    to, kind: 'staff_digest', siteId: site.id, subject,
    html: staffDigestHtml({
      propertyName: site.name,
      accent: site.accent_color ?? '#6CABD4',
      movedIn: rows.movedIn,
      movedOut: rows.movedOut,
      unitChanged: rows.unitChanged,
      guard,
      needsAttention: attention,
    }),
  })
}
