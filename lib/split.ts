import type { SiteSplit, SplitParty, SplitShare } from './types'

/**
 * Where the money from one transaction goes.
 *
 * Four parties — Gate Guard, Hello Package, the sales rep and the servicing
 * dealer — and the mix is SITE configuration, not a platform constant. A
 * community we sold and service ourselves splits nothing like one a partner
 * sold and a third party services.
 *
 * The property is deliberately not a party. It receives no share of the
 * parking and amenity fee or of optional resident services; see §5.2 of the
 * Property Partnership Agreement. If that ever changes, it changes in the
 * agreement first and here second.
 *
 * ── Why this is its own module ───────────────────────────────────────────────
 * Stripe Connect can split one charge to one connected account plus an
 * application fee. It cannot express four parties on one payment, and it
 * cannot answer "what did this dealer earn in March". So the money moves as
 * separate charges and transfers, and the arithmetic lives here — pure, with
 * no Stripe and no database, because this is the part where a rounding error
 * becomes someone's missing dollar.
 */

export interface Allocation {
  party: SplitParty
  label: string
  stripeAccountId: string | null
  bps: number
  amountCents: number
}

export interface SplitResult {
  /** What the resident paid, less Stripe's own fee if one is passed in. */
  netCents: number
  allocations: Allocation[]
  /** Always equals netCents. Asserted, not hoped for. */
  totalAllocatedCents: number
}

export class SplitError extends Error {}

/** Shares must describe the whole pie, exactly once each. */
export function validateSplit(split: SiteSplit): void {
  if (split.shares.length === 0) {
    throw new SplitError(`Site ${split.siteSlug} has no split configured`)
  }

  const seen = new Set<SplitParty>()
  for (const s of split.shares) {
    if (seen.has(s.party)) {
      throw new SplitError(`Site ${split.siteSlug} lists ${s.party} twice`)
    }
    if (s.bps < 0) {
      throw new SplitError(`Site ${split.siteSlug} gives ${s.party} a negative share`)
    }
    seen.add(s.party)
  }

  const total = split.shares.reduce((n, s) => n + s.bps, 0)
  if (total !== 10_000) {
    throw new SplitError(
      `Site ${split.siteSlug} shares total ${total} bps, not 10000. ` +
      `Refusing to guess who the remainder belongs to.`,
    )
  }
}

/**
 * Allocate an amount across a site's parties.
 *
 * Largest-remainder: floor every share, then hand the leftover cents out one
 * at a time to whoever lost the most in rounding. Ties break by the order the
 * shares are configured in, so the same input always produces the same output
 * — a payout report that shifts a cent between runs is a support ticket.
 *
 * The alternative, rounding each share independently, does not sum to the
 * total. On a $150 fee across four parties that is off by a cent often enough
 * to matter once, and once is enough.
 */
export function allocate(args: {
  split: SiteSplit
  amountCents: number
  /** Stripe's processing fee, deducted before the split. */
  processingFeeCents?: number
}): SplitResult {
  validateSplit(args.split)

  if (args.amountCents < 0) {
    throw new SplitError('Cannot allocate a negative amount')
  }

  const netCents = Math.max(0, args.amountCents - (args.processingFeeCents ?? 0))

  const scratch = args.split.shares.map((s: SplitShare, i: number) => {
    const exact = (netCents * s.bps) / 10_000
    const floor = Math.floor(exact)
    return { share: s, i, floor, remainder: exact - floor }
  })

  let left = netCents - scratch.reduce((n, r) => n + r.floor, 0)

  const order = [...scratch].sort((a, b) =>
    b.remainder - a.remainder || a.i - b.i)

  const extra = new Map<number, number>()
  for (const r of order) {
    if (left <= 0) break
    extra.set(r.i, 1)
    left -= 1
  }

  const allocations: Allocation[] = scratch.map(r => ({
    party: r.share.party,
    label: r.share.label,
    stripeAccountId: r.share.stripeAccountId,
    bps: r.share.bps,
    amountCents: r.floor + (extra.get(r.i) ?? 0),
  }))

  const totalAllocatedCents = allocations.reduce((n, a) => n + a.amountCents, 0)

  // Not a matter of taste. If this ever fails, someone is short.
  if (totalAllocatedCents !== netCents) {
    throw new SplitError(
      `Allocated ${totalAllocatedCents} of ${netCents} for ${args.split.siteSlug}`,
    )
  }

  return { netCents, allocations, totalAllocatedCents }
}

/**
 * Which parties still need a Stripe account before this site can take money.
 *
 * Called at site activation rather than at checkout: discovering a missing
 * destination account while a resident is standing at the gate with a card in
 * their hand is the wrong time to find out.
 */
export function unroutableParties(split: SiteSplit): SplitShare[] {
  return split.shares.filter(s => s.bps > 0 && !s.stripeAccountId)
}
