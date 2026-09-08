import type { Concession, ParkingFee } from './types'

/**
 * What the resident actually pays for the parking and amenity fee.
 *
 * The fee is one charge per UNIT, taken at sign-up — not per resident, and not
 * per month. The primary resident pays it and authorises the household's other
 * passes against it.
 *
 * Pure, and separated from the screen because it is money: a concession that
 * over-covers, or a partial that reads as full, is a mistake someone finds in a
 * statement rather than in review.
 */

export interface FeeBreakdown {
  /** The property's full one-time fee for this unit. */
  baseCents: number
  /** How much of it the property is comping. */
  coveredCents: number
  /** What the resident is actually charged at sign-up. */
  netCents: number
  fullyCovered: boolean
  partiallyCovered: boolean
  termMonths: number | null
  shortTerm: boolean
}

export function computeFee(args: {
  fee: ParkingFee | null
  concession: Concession | null
  termMonths: number | null
}): FeeBreakdown | null {
  if (!args.fee) return null

  const baseCents = args.fee.amountCents

  // A concession can never cover more than the fee. Clamping here rather than
  // trusting the data means a fat-fingered grant shows a $0 fee, not a credit.
  const coveredCents = Math.max(0, Math.min(args.concession?.coversCents ?? 0, baseCents))
  const netCents = baseCents - coveredCents
  const termMonths = args.termMonths

  return {
    baseCents,
    coveredCents,
    netCents,
    fullyCovered: coveredCents > 0 && netCents === 0,
    partiallyCovered: coveredCents > 0 && netCents > 0,
    termMonths,
    // Twelve months is the assumption everything else is built around; below
    // that the term is worth stating so the resident can see it was noticed.
    shortTerm: termMonths !== null && termMonths < 12,
  }
}
