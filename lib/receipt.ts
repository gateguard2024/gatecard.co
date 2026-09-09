import type { MoveInContext, PromoResult } from './types'
import { computeFee } from './fees'

/**
 * One itemised summary of everything a resident set up.
 *
 * Everything now settles through one card at sign-up: the unit's parking and
 * amenity fee, any physical add-ons, and any monthly service the resident chose
 * to add. There is no lease rail and no rent ledger — we have no access to one
 * and nothing here claims otherwise.
 *
 * What the property paid for a concession pass never appears. The resident sees
 * that their fee is covered and by whom; the block's unit cost is our commercial
 * arrangement with the property and is none of the resident's business.
 *
 * Pure — no context beyond what is passed in, so it renders identically on a
 * screen, in an email and in a PDF rather than drifting between them.
 */

export type Cadence = 'once' | 'monthly'

export interface ReceiptLine {
  id: string
  label: string
  detail?: string
  /** Negative for a concession credit. */
  amountCents: number
  cadence: Cadence
  /** Set for things with no price: an activation, a quote request. */
  note?: string
}

export interface Receipt {
  lines: ReceiptLine[]
  /** Charged to the card now. */
  dueTodayCents: number
  /** Recurring, starting at move-in. */
  monthlyCents: number
  /** Requested but not sold — activations and quotes. */
  pending: ReceiptLine[]
}

export interface ReceiptInput {
  ctx: MoveInContext
  /** Per household member: whether they hold a pass, and their add-on. */
  members: Record<string, { pass: boolean; addOn: 'none' | 'fob' | 'keytag' }>
  serviceIds: string[]
  requestedIds: string[]
  promo: PromoResult | null
}

export function buildReceipt(input: ReceiptInput): Receipt {
  const { ctx } = input
  const lines: ReceiptLine[] = []

  // ── The unit's one-time fee ────────────────────────────────────────────────
  // One charge per unit, not per person. Authorising a second pass adds nothing.
  const fee = computeFee({ fee: ctx.property.parkingFee, promo: input.promo })

  if (fee) {
    lines.push({
      id: 'fee',
      label: ctx.property.parkingFee!.label,
      detail: ctx.property.parkingFee!.covers || undefined,
      amountCents: fee.baseCents,
      cadence: 'once',
    })

    // Its own negative line rather than folded into the fee, so the resident
    // can see what the property did for them — and so it is visible if a code
    // is later reversed.
    if (fee.coveredCents > 0) {
      lines.push({
        id: 'concession',
        label: `Concession — code ${input.promo!.code}`,
        detail: `Covered by ${ctx.property.name}`,
        amountCents: -fee.coveredCents,
        cadence: 'once',
      })
    }
  }

  // ── Physical add-ons, one per person with a pass ──────────────────────────
  for (const m of ctx.resident.household) {
    const sel = input.members[m.id]
    if (!sel?.pass || sel.addOn === 'none') continue
    const c = ctx.credentials.find(x => x.kind === sel.addOn)
    if (!c || c.priceCents <= 0) continue
    lines.push({
      id: `addon-${m.id}`,
      label: `${c.label} — ${m.firstName}`,
      detail: 'Ships blank, activates on first tap',
      amountCents: c.priceCents,
      cadence: 'once',
    })
  }

  // ── Monthly services the resident actually added ──────────────────────────
  for (const id of input.serviceIds) {
    const o = ctx.services.find(x => x.id === id)
    if (!o || o.monthlyCents == null) continue
    lines.push({
      id: `svc-${id}`,
      label: o.name,
      detail: o.provider,
      amountCents: o.monthlyCents,
      cadence: 'monthly',
    })
  }

  // Activations and quote requests are on the receipt because the resident
  // asked for them and will expect to see them — but they carry no amount,
  // because neither is a sale.
  const pending: ReceiptLine[] = []
  for (const id of input.requestedIds) {
    const o = ctx.services.find(x => x.id === id)
    if (!o) continue
    pending.push({
      id: `req-${id}`,
      label: o.mode === 'quote' ? `${o.name} consultation` : `${o.name} activation`,
      amountCents: 0,
      cadence: 'once',
      note: o.mode === 'quote'
        ? 'Nothing charged until you approve a quote'
        : 'Live for your move-in date',
    })
  }

  const sum = (c: Cadence) =>
    lines.filter(l => l.cadence === c).reduce((n, l) => n + l.amountCents, 0)

  return {
    lines,
    dueTodayCents: Math.max(0, sum('once')),
    monthlyCents: Math.max(0, sum('monthly')),
    pending,
  }
}
