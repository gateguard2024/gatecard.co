/**
 * Roster reconciliation — who moved in, who moved out.
 *
 * Pure. No network, no database, no clock beyond what's passed in. This is the
 * function that decides whether to tell a building it has moved out, so it is
 * the one that has to be testable in isolation.
 *
 * ── Why this is a diff and not a webhook ────────────────────────────────────
 * Brivo pushes ACCESS events. It does not push roster changes. So a move-in is
 * "a Brivo user id we have never seen at this site", and a move-out is "a user
 * id that stopped appearing".
 *
 * ── Why absence is dangerous ────────────────────────────────────────────────
 * A truncated page, a 500 on page 4, a paging bug, or a PMS hiccup all look
 * exactly like residents leaving. The previous implementation deactivated every
 * resident missing from a single fetch, with no guard — one bad response would
 * have emptied a property's intercom directory. Three defences here:
 *
 *   1. A run that did not fetch every page cleanly can never conclude a
 *      move-out.
 *   2. A roster that shrank more than the site's threshold is treated as a bad
 *      pull, not as mass move-out. The run records what it would have done.
 *   3. A resident must be absent from N consecutive clean runs AND past a grace
 *      period. Someone removed and re-added inside the window produces nothing.
 */

export type LifecycleStatus = 'current' | 'pending_move_out' | 'moved_out'

export interface KnownResident {
  id: string
  brivoUserId: string
  unitNumber: string | null
  lifecycleStatus: LifecycleStatus
  missingSince: string | null
  missingStreak: number
}

export interface RosterEntry {
  brivoUserId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  unitNumber: string | null
}

export interface Policy {
  mode: 'baseline' | 'live'
  confirmRuns: number
  graceHours: number
  shrinkGuardPct: number
  /** A tiny property can lose 20% by one person leaving. Below this count the
   *  percentage guard is meaningless, so it's skipped. */
  minRosterForShrinkGuard?: number
}

export interface Reconciliation {
  guard: { reason: string; detail: string } | null
  baseline: boolean

  movedIn: RosterEntry[]
  returned: { known: KnownResident; entry: RosterEntry }[]
  unitChanged: { known: KnownResident; entry: RosterEntry; from: string | null; to: string }[]
  seen: { known: KnownResident; entry: RosterEntry }[]

  markMissing: { known: KnownResident; streak: number; missingSince: string }[]
  clearMissing: KnownResident[]
  movedOut: { known: KnownResident; absentSince: string }[]

  rosterCount: number
  previousCount: number
}

const HOUR_MS = 3_600_000

function empty(rosterCount: number, previousCount: number): Reconciliation {
  return {
    guard: null, baseline: false,
    movedIn: [], returned: [], unitChanged: [], seen: [],
    markMissing: [], clearMissing: [], movedOut: [],
    rosterCount, previousCount,
  }
}

export function reconcile(args: {
  known: KnownResident[]
  roster: RosterEntry[]
  policy: Policy
  fetchComplete: boolean
  now?: Date
}): Reconciliation {
  const now = args.now ?? new Date()
  const nowIso = now.toISOString()

  // Anyone already moved out is not a candidate for moving out again.
  const live = args.known.filter(k => k.lifecycleStatus !== 'moved_out')
  const out = empty(args.roster.length, live.length)

  // ── Guard 1 · an incomplete fetch proves nothing about absence ─────────────
  if (!args.fetchComplete) {
    out.guard = {
      reason: 'incomplete_fetch',
      detail: 'Roster fetch did not complete every page; absence is not evidence of move-out.',
    }
    return out
  }

  const byId = new Map(args.roster.map(r => [r.brivoUserId, r]))
  const knownById = new Map(args.known.map(k => [k.brivoUserId, k]))

  // ── Baseline · adopt the roster, fire nothing ──────────────────────────────
  // Onboarding a property must not look like 832 people moving in at once.
  if (args.policy.mode === 'baseline') {
    out.baseline = true
    for (const entry of args.roster) {
      const k = knownById.get(entry.brivoUserId)
      if (k) out.seen.push({ known: k, entry })
      else out.movedIn.push(entry) // recorded as pre-existing; no notification
    }
    return out
  }

  // ── Guard 2 · a roster that collapsed is a bad pull, not an exodus ─────────
  const minForGuard = args.policy.minRosterForShrinkGuard ?? 20
  if (live.length >= minForGuard) {
    const shrinkPct = ((live.length - args.roster.length) / live.length) * 100
    if (shrinkPct > args.policy.shrinkGuardPct) {
      out.guard = {
        reason: 'roster_shrink',
        detail:
          `Roster fell from ${live.length} to ${args.roster.length} ` +
          `(${shrinkPct.toFixed(1)}% > ${args.policy.shrinkGuardPct}% allowed). ` +
          `Treating as a bad pull. No move-outs processed.`,
      }
      return out
    }
  }

  // Also refuse to act on an empty roster at a property that had residents —
  // the percentage check catches this too, but only above the minimum count.
  if (args.roster.length === 0 && live.length > 0) {
    out.guard = {
      reason: 'empty_roster',
      detail: `Brivo returned zero users for a site with ${live.length} residents.`,
    }
    return out
  }

  // ── Present ────────────────────────────────────────────────────────────────
  for (const entry of args.roster) {
    const k = knownById.get(entry.brivoUserId)

    if (!k) {
      out.movedIn.push(entry)
      continue
    }

    if (k.lifecycleStatus === 'moved_out') {
      // Back at this property — a new tenancy, and it should feel like a fresh
      // move-in. Keying anything on the resident row would swallow this.
      out.returned.push({ known: k, entry })
      continue
    }

    if (k.missingSince) out.clearMissing.push(k)

    // An internal transfer is neither a move-in nor a move-out. Parking follows
    // them; the credential does not change.
    if (entry.unitNumber && entry.unitNumber !== k.unitNumber) {
      out.unitChanged.push({ known: k, entry, from: k.unitNumber, to: entry.unitNumber })
    }

    out.seen.push({ known: k, entry })
  }

  // ── Absent ─────────────────────────────────────────────────────────────────
  for (const k of live) {
    if (byId.has(k.brivoUserId)) continue

    const streak = k.missingStreak + 1
    const since = k.missingSince ?? nowIso
    const elapsedHours = (now.getTime() - new Date(since).getTime()) / HOUR_MS

    const confirmed =
      streak >= args.policy.confirmRuns && elapsedHours >= args.policy.graceHours

    if (confirmed) out.movedOut.push({ known: k, absentSince: since })
    else out.markMissing.push({ known: k, streak, missingSince: since })
  }

  return out
}

/** One-line summary for the run log and the staff digest. */
export function summarise(r: Reconciliation): string {
  if (r.guard) return `GUARDED (${r.guard.reason}) — ${r.guard.detail}`
  if (r.baseline) return `Baseline adopted ${r.movedIn.length + r.seen.length} residents; no notifications sent.`
  const bits = [
    r.movedIn.length && `${r.movedIn.length} moved in`,
    r.returned.length && `${r.returned.length} returned`,
    r.unitChanged.length && `${r.unitChanged.length} changed unit`,
    r.movedOut.length && `${r.movedOut.length} moved out`,
    r.markMissing.length && `${r.markMissing.length} pending`,
  ].filter(Boolean)
  return bits.length ? bits.join(', ') : 'No changes'
}
