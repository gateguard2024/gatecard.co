import type { MoveInContext } from './types'
import { computeFee } from './fees'

/**
 * One itemised summary of everything a resident set up.
 *
 * ── One receipt, not one charge ─────────────────────────────────────────────
 * The ask was a single document rather than "a fee somewhere on your lease" and
 * "a separate card charge". That is worth having, and it does NOT require
 * putting the lease-bound fee on a card — which is what a single *transaction*
 * would require, and what D3 blocks while the collection path is unresolved.
 *
 * So every line carries its rail, and the document says plainly how each one is
 * paid. A resident gets one thing to read; the money keeps travelling by two
 * routes. Presenting them as one payment would be the lie.
 *
 * Pure — no context beyond what is passed in, so it can render on a screen, in
 * an email, and in a PDF without drifting between them.
 */

export type Rail = 'lease' | 'card'
export type Cadence = 'once' | 'monthly'

export interface ReceiptLine {
  id: string
  label: string
  detail?: string
  /** Negative for a concession. */
  amountCents: number
  cadence: Cadence
  rail: Rail
  /** Set for things with no price: an activation, a quote request. */
  note?: string
}

export interface Receipt {
  lines: ReceiptLine[]
  cardTodayCents: number
  cardMonthlyCents: number
  leaseMonthlyCents: number
  hasCard: boolean
  hasLease: boolean
}

export interface ReceiptInput {
  ctx: MoveInContext
  credentialKinds: string[]
  cart: Record<string, number>
  serviceIds: string[]
  requestedIds: string[]
}

export function buildReceipt(input: ReceiptInput): Receipt {
  const { ctx } = input
  const lines: ReceiptLine[] = []

  // ── Lease rail ────────────────────────────────────────────────────────────
  const fee = computeFee({
    fee: ctx.property.parkingFee,
    concession: ctx.resident.concession,
    termMonths: ctx.resident.leaseTermMonths,
  })

  if (fee) {
    lines.push({
      id: 'fee',
      label: ctx.property.parkingFee!.label,
      detail: ctx.property.parkingFee!.covers || undefined,
      amountCents: fee.baseCents,
      cadence: 'monthly',
      rail: 'lease',
    })

    // Shown as its own negative line rather than folded into the fee, so the
    // resident can see what the property is doing for them — and so it is
    // visible when it lapses.
    if (fee.coveredCents > 0) {
      lines.push({
        id: 'concession',
        label: ctx.resident.concession!.label,
        detail: fee.revertsOn
          ? `First ${ctx.resident.concession!.months} months`
          : 'For your lease term',
        amountCents: -fee.coveredCents,
        cadence: 'monthly',
        rail: 'lease',
      })
    }
  }

  // ── Card rail ─────────────────────────────────────────────────────────────
  for (const kind of input.credentialKinds) {
    const c = ctx.credentials.find(x => x.kind === kind)
    if (!c || c.priceCents <= 0) continue
    lines.push({
      id: `cred-${kind}`,
      label: c.label,
      detail: 'Ships blank, activates on first tap',
      amountCents: c.priceCents,
      cadence: 'once',
      rail: 'card',
    })
  }

  for (const [id, qty] of Object.entries(input.cart)) {
    const p = ctx.store.find(x => x.id === id)
    if (!p || qty <= 0) continue
    lines.push({
      id: `store-${id}`,
      label: qty > 1 ? `${p.name} × ${qty}` : p.name,
      amountCents: p.priceCents * qty,
      cadence: 'once',
      rail: 'card',
    })
  }

  for (const id of input.serviceIds) {
    const o = ctx.services.find(x => x.id === id)
    if (!o || o.monthlyCents == null) continue
    lines.push({
      id: `svc-${id}`,
      label: o.name,
      detail: o.provider,
      amountCents: o.monthlyCents,
      cadence: 'monthly',
      rail: 'card',
    })
  }

  // Activations and quote requests are on the receipt because the resident
  // asked for them and will expect to see them — but they carry no amount,
  // because neither is a sale.
  for (const id of input.requestedIds) {
    const o = ctx.services.find(x => x.id === id)
    if (!o) continue
    lines.push({
      id: `req-${id}`,
      label: o.mode === 'quote' ? `${o.name} consultation` : `${o.name} activation`,
      amountCents: 0,
      cadence: 'once',
      rail: 'card',
      note: o.mode === 'quote'
        ? 'Nothing charged until you approve a quote'
        : 'Live for your move-in date',
    })
  }

  const sum = (rail: Rail, cadence: Cadence) =>
    lines
      .filter(l => l.rail === rail && l.cadence === cadence)
      .reduce((n, l) => n + l.amountCents, 0)

  const leaseMonthlyCents = Math.max(0, sum('lease', 'monthly'))

  return {
    lines,
    cardTodayCents: sum('card', 'once'),
    cardMonthlyCents: sum('card', 'monthly'),
    leaseMonthlyCents,
    hasCard: lines.some(l => l.rail === 'card' && l.amountCents > 0),
    hasLease: lines.some(l => l.rail === 'lease'),
  }
}
