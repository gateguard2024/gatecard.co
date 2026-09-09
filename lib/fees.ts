import type { ParkingFee, PromoCode, PromoResult } from './types'

/**
 * The parking and amenity fee, and what a promo code does to it.
 *
 * The fee is one charge per UNIT, taken at sign-up. Not per resident, not per
 * month. The primary resident pays it and authorises the household's other
 * passes against it — a second or third pass adds nothing.
 *
 * A property may buy concession passes in blocks at a discounted unit price and
 * hand the resulting codes to residents. Redeeming one takes the fee to zero;
 * the property has already paid. What the property paid is never shown to the
 * resident and never appears in a total.
 *
 * Pure, and separated from the screens because it is money: a code that
 * over-covers, or a refusal with no stated reason, is a call to the leasing
 * office either way.
 */

export interface FeeBreakdown {
  /** The property's full one-time fee for this unit. */
  baseCents: number
  /** Covered by a redeemed promo code. */
  coveredCents: number
  /** What the resident is actually charged at sign-up. */
  netCents: number
  fullyCovered: boolean
  partiallyCovered: boolean
}

export function computeFee(args: {
  fee: ParkingFee | null
  /** The code the resident successfully redeemed, if any. */
  promo: PromoResult | null
}): FeeBreakdown | null {
  if (!args.fee) return null

  const baseCents = args.fee.amountCents

  // A code can never cover more than the fee. Clamping here rather than
  // trusting the record means a mis-issued block shows a $0 fee, not a credit.
  const coveredCents = args.promo?.ok
    ? Math.max(0, Math.min(args.promo.coversCents, baseCents))
    : 0

  const netCents = baseCents - coveredCents

  return {
    baseCents,
    coveredCents,
    netCents,
    fullyCovered: coveredCents > 0 && netCents === 0,
    partiallyCovered: coveredCents > 0 && netCents > 0,
  }
}

/**
 * Validate a typed code against the property's issued blocks.
 *
 * Every refusal names its reason. "Invalid code" on a screen the resident
 * cannot get past is how a move-in becomes a phone call — and the leasing agent
 * who handed out the card needs to know whether it was already used or simply
 * mistyped.
 */
export function redeemPromo(args: {
  input: string
  codes: PromoCode[]
  fee: ParkingFee | null
  /** ISO date; injected so this stays pure and testable. */
  today: string
}): PromoResult {
  const code = args.input.trim().toUpperCase().replace(/\s+/g, '')

  if (!code) {
    return { ok: false, code, coversCents: 0, reason: null }
  }

  const found = args.codes.find(c => c.code.toUpperCase() === code)

  if (!found) {
    return {
      ok: false, code, coversCents: 0,
      reason: 'We don’t recognise that code. Check it against the card from your leasing office.',
    }
  }
  if (found.status === 'redeemed') {
    return {
      ok: false, code, coversCents: 0,
      reason: 'That code has already been used. Your leasing office can issue another.',
    }
  }
  if (found.status === 'void') {
    return {
      ok: false, code, coversCents: 0,
      reason: 'That code was cancelled by the property. Ask your leasing office for a current one.',
    }
  }
  if (found.status === 'expired' ||
      (found.expiresOn !== null && found.expiresOn < args.today.slice(0, 10))) {
    return {
      ok: false, code, coversCents: 0,
      reason: 'That code has expired. Your leasing office can issue another.',
    }
  }

  const cap = args.fee?.amountCents ?? 0
  return {
    ok: true,
    code: found.code,
    coversCents: Math.max(0, Math.min(found.coversCents, cap)),
    reason: null,
  }
}
