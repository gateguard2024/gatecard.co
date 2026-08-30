import type { Concession, ParkingFee } from './types'

/**
 * What the resident actually pays, after a concession, for their actual term.
 *
 * Pure, and separated from the screen because it is money: a concession that
 * over-covers, a partial that reads as full, or a fee that ignores a nine-month
 * lease are all mistakes someone finds in a statement rather than in review.
 */

export interface FeeBreakdown {
  baseCents: number
  coveredCents: number
  netCents: number
  fullyCovered: boolean
  partiallyCovered: boolean
  /** Set when the concession runs out before the lease does. */
  revertsCents: number | null
  revertsOn: string | null
  termMonths: number | null
  shortTerm: boolean
}

export function computeFee(args: {
  fee: ParkingFee | null
  concession: Concession | null
  termMonths: number | null
}): FeeBreakdown | null {
  if (!args.fee) return null

  const baseCents = args.fee.monthlyCents

  // A concession can never cover more than the fee. Clamping here rather than
  // trusting the data means a fat-fingered grant shows a $0 fee, not a credit.
  const coveredCents = Math.max(0, Math.min(args.concession?.coversCents ?? 0, baseCents))
  const netCents = baseCents - coveredCents

  const termMonths = args.termMonths
  const cMonths = args.concession?.months ?? null

  // The concession expires before the lease ends: the resident's payment goes
  // UP partway through. Saying so now is the difference between a planned
  // change and a surprise.
  const expiresEarly =
    coveredCents > 0 &&
    cMonths !== null &&
    (termMonths === null || cMonths < termMonths)

  return {
    baseCents,
    coveredCents,
    netCents,
    fullyCovered: coveredCents > 0 && netCents === 0,
    partiallyCovered: coveredCents > 0 && netCents > 0,
    revertsCents: expiresEarly ? baseCents : null,
    revertsOn: expiresEarly ? args.concession?.endsOn ?? null : null,
    termMonths,
    // Twelve months is the assumption everything else is built around; below
    // that the term is worth stating so the resident can see it was noticed.
    shortTerm: termMonths !== null && termMonths < 12,
  }
}
