import 'server-only'
import { COMMISSION_HOLD_DAYS } from './env'

/**
 * The commission ledger (D4).
 *
 * Supabase owns this, not Stripe. Connect can split one charge to one connected
 * account plus an application fee — it cannot express corporate → master agent
 * → master dealer → install/service/sales, and it cannot answer "what does this
 * master agent earn this month". So the money movement is separate charges and
 * transfers, and the accounting lives here.
 *
 * This module is deliberately pure: no Stripe, no Supabase, no clock beyond
 * what's passed in. It is the piece most worth testing and least worth mocking.
 */

export const TIERS = [
  'corporate',
  'master_agent',
  'master_dealer',
  'sales_partner',
  'install_dealer',
  'service_dealer',
] as const

export type Tier = (typeof TIERS)[number]
export type ItemKind = 'credential' | 'merch' | 'service'

export interface CommissionRate {
  tier: Tier
  ratePct: number
  /** Null applies to every kind; a kind-specific rate wins over it. */
  itemKind: ItemKind | null
  /** Null is the platform default; a site-specific rate wins over it. */
  siteId: string | null
}

/** Which org occupies each tier for a given site. Absent tiers are skipped. */
export type PartyMap = Partial<Record<Tier, string>>

export interface ChargeableItem {
  id: string
  kind: ItemKind
  amountCents: number
}

export interface CommissionEntry {
  tier: Tier
  partyOrgId: string
  orderItemId: string
  basisCents: number
  ratePct: number
  amountCents: number
  holdUntil: string
  payPeriod: string
}

/**
 * Most specific rate wins: site + kind, then site, then default + kind, then
 * default. A property that negotiated its own split gets it without anyone
 * having to restate every other rate.
 */
export function resolveRate(
  rates: CommissionRate[],
  tier: Tier,
  kind: ItemKind,
  siteId: string,
): number | null {
  const forTier = rates.filter(r => r.tier === tier)
  const pick =
    forTier.find(r => r.siteId === siteId && r.itemKind === kind) ??
    forTier.find(r => r.siteId === siteId && r.itemKind === null) ??
    forTier.find(r => r.siteId === null && r.itemKind === kind) ??
    forTier.find(r => r.siteId === null && r.itemKind === null)
  return pick ? pick.ratePct : null
}

/** Half-up, so a 2.5 never silently rounds toward the house. */
function roundCents(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n))
}

export function payPeriodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function holdUntil(from: Date, days = COMMISSION_HOLD_DAYS): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Turn one paid order into ledger entries — one per tier per item.
 *
 * Entries start held rather than released. A refund or chargeback inside the
 * hold window is a status change here instead of clawing money back out of a
 * dealer's bank account.
 *
 * Throws if the splits exceed the item. Silently paying out more than was
 * collected is the one failure mode that must never reach production.
 */
export function computeCommissions(args: {
  siteId: string
  items: ChargeableItem[]
  parties: PartyMap
  rates: CommissionRate[]
  at?: Date
}): CommissionEntry[] {
  const at = args.at ?? new Date()
  const period = payPeriodOf(at)
  const hold = holdUntil(at)
  const out: CommissionEntry[] = []

  for (const item of args.items) {
    if (item.amountCents <= 0) continue
    let allocated = 0

    for (const tier of TIERS) {
      const org = args.parties[tier]
      if (!org) continue

      const rate = resolveRate(args.rates, tier, item.kind, args.siteId)
      if (rate === null || rate === 0) continue

      const amount = roundCents((item.amountCents * rate) / 100)
      if (amount <= 0) continue

      allocated += amount
      out.push({
        tier,
        partyOrgId: org,
        orderItemId: item.id,
        basisCents: item.amountCents,
        ratePct: rate,
        amountCents: amount,
        holdUntil: hold,
        payPeriod: period,
      })
    }

    if (allocated > item.amountCents) {
      throw new Error(
        `Commission splits (${allocated}¢) exceed item ${item.id} ` +
        `(${item.amountCents}¢). Check resident_commission_rates for site ${args.siteId}.`
      )
    }
  }

  return out
}

/** What Gate Guard keeps after every tier is paid, per item and in total. */
export function retainedCents(
  items: ChargeableItem[],
  entries: CommissionEntry[],
): number {
  const gross = items.reduce((n, i) => n + i.amountCents, 0)
  const paid = entries.reduce((n, e) => n + e.amountCents, 0)
  return gross - paid
}
