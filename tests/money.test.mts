/**
 * Money arithmetic — the split and the fee.
 *
 * Run:  node --experimental-strip-types tests/money.test.mts
 *
 * These two modules are pure on purpose, and this is why: a rounding error in
 * allocate() is somebody's missing dollar in a payout report, and a promo code
 * that over-covers is a fee nobody collected. Both are found in a statement
 * weeks later, not in review.
 */
import { allocate, validateSplit, unroutableParties, SplitError } from '../lib/split.ts'
import { computeFee, redeemPromo } from '../lib/fees.ts'
import type { SiteSplit } from '../lib/types.ts'

let n = 0, bad = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL:', m) } }
const throws = (f: () => unknown, m: string) => {
  n++
  try { f(); console.log('FAIL (no throw):', m); bad++ } catch { /* expected */ }
}

const mk = (shares: [string, number][]): SiteSplit => ({
  siteSlug: 't',
  shares: shares.map(([party, bps]) => ({
    party: party as never, bps, stripeAccountId: null, label: party })),
})

// ── validate ────────────────────────────────────────────────────────────────
throws(() => validateSplit(mk([])), 'empty split rejected')
throws(() => validateSplit(mk([['gateguard', 9999]])), '9999 bps rejected')
throws(() => validateSplit(mk([['gateguard', 5000], ['gateguard', 5000]])), 'duplicate party rejected')
throws(() => validateSplit(mk([['gateguard', 11000], ['sales_rep', -1000]])), 'negative share rejected')
validateSplit(mk([['gateguard', 5500], ['hello_package', 2000], ['sales_rep', 1000], ['servicing_dealer', 1500]]))
ok(true, 'valid four-way accepted')

// ── allocation sums exactly ─────────────────────────────────────────────────
const four = mk([['gateguard', 5500], ['hello_package', 2000], ['sales_rep', 1000], ['servicing_dealer', 1500]])
for (const amt of [0, 1, 2, 3, 7, 99, 4500, 7500, 12500, 15000, 19500, 100001]) {
  const r = allocate({ split: four, amountCents: amt })
  ok(r.totalAllocatedCents === amt, `four-way sums exactly at ${amt}`)
  ok(r.allocations.every(a => a.amountCents >= 0), `no negative allocation at ${amt}`)
}

// A three-way 1/3 split is the classic place a cent goes missing.
const thirds = mk([['gateguard', 3333], ['hello_package', 3333], ['sales_rep', 3334]])
for (let amt = 0; amt <= 300; amt++) {
  const r = allocate({ split: thirds, amountCents: amt })
  ok(r.totalAllocatedCents === amt, `thirds sum exactly at ${amt}`)
}
ok(true, 'thirds swept 0..300')

// ── determinism ─────────────────────────────────────────────────────────────
const a1 = allocate({ split: four, amountCents: 15000 })
const a2 = allocate({ split: four, amountCents: 15000 })
ok(JSON.stringify(a1) === JSON.stringify(a2), 'allocation is deterministic')

// ── processing fee comes off the top ────────────────────────────────────────
const withFee = allocate({ split: four, amountCents: 15000, processingFeeCents: 465 })
ok(withFee.netCents === 14535, 'processing fee deducted before split')
ok(withFee.totalAllocatedCents === 14535, 'net fully allocated')
ok(allocate({ split: four, amountCents: 100, processingFeeCents: 500 }).netCents === 0,
   'fee larger than amount floors at zero, does not go negative')
throws(() => allocate({ split: four, amountCents: -1 }), 'negative amount rejected')

// ── the $150 fee, four ways ─────────────────────────────────────────────────
const fee = allocate({ split: four, amountCents: 15000 })
const by = (p: string) => fee.allocations.find(a => a.party === p)!.amountCents
ok(by('gateguard') === 8250, 'gateguard 55% of $150 = $82.50')
ok(by('hello_package') === 3000, 'hello package 20% = $30.00')
ok(by('sales_rep') === 1500, 'sales rep 10% = $15.00')
ok(by('servicing_dealer') === 2250, 'servicing dealer 15% = $22.50')

// ── routing readiness ───────────────────────────────────────────────────────
ok(unroutableParties(four).length === 4, 'all four flagged while unrouted')
const routed = mk([['gateguard', 10000]])
routed.shares[0].stripeAccountId = 'acct_123'
ok(unroutableParties(routed).length === 0, 'routed party not flagged')
const zero = mk([['gateguard', 10000], ['sales_rep', 0]])
zero.shares[0].stripeAccountId = 'acct_123'
ok(unroutableParties(zero).length === 0, 'a zero share needs no account')

// ── fees + promo ────────────────────────────────────────────────────────────
const PF = { label: 'Parking & amenity fee', amountCents: 15000, covers: '' }
const CODES = [
  { code: 'EP-4K7M-QX28', blockId: 'b', costCents: 12000, coversCents: 15000,
    status: 'unused' as const, expiresOn: null },
  { code: 'EP-9T2B-HR54', blockId: 'b', costCents: 12000, coversCents: 15000,
    status: 'redeemed' as const, expiresOn: null },
  { code: 'EP-1D6N-VW90', blockId: 'b', costCents: 12000, coversCents: 15000,
    status: 'unused' as const, expiresOn: '2026-06-30' },
  { code: 'EP-OVER-9999', blockId: 'b', costCents: 12000, coversCents: 99999,
    status: 'unused' as const, expiresOn: null },
]
const R = (input: string) => redeemPromo({ input, codes: CODES, fee: PF, today: '2026-09-09' })

ok(R('EP-4K7M-QX28').ok, 'valid code accepted')
ok(R('  ep-4k7m-qx28  ').ok, 'code is case and whitespace insensitive')
ok(!R('EP-9T2B-HR54').ok && /already been used/.test(R('EP-9T2B-HR54').reason!), 'redeemed code names its reason')
ok(!R('EP-1D6N-VW90').ok && /expired/.test(R('EP-1D6N-VW90').reason!), 'expired code names its reason')
ok(!R('NOPE').ok && /recognise/.test(R('NOPE').reason!), 'unknown code names its reason')
ok(!R('').ok && R('').reason === null, 'empty input is not an error message')
ok(R('EP-OVER-9999').coversCents === 15000, 'a code cannot cover more than the fee')

ok(computeFee({ fee: PF, promo: null })!.netCents === 15000, 'no code means full fee')
ok(computeFee({ fee: PF, promo: R('EP-4K7M-QX28') })!.netCents === 0, 'valid code zeroes the fee')
ok(computeFee({ fee: PF, promo: R('EP-4K7M-QX28') })!.fullyCovered, 'and reads as fully covered')
ok(computeFee({ fee: PF, promo: R('NOPE') })!.netCents === 15000, 'a refused code charges the full fee')
ok(computeFee({ fee: null, promo: null }) === null, 'no fee configured returns null')
ok(computeFee({ fee: PF, promo: { ok: true, code: 'X', coversCents: 5000, reason: null } })!
     .partiallyCovered, 'a partial code reads as partial')

console.log(bad === 0 ? `\nPASS — ${n} assertions` : `\n${bad} of ${n} FAILED`)
process.exit(bad === 0 ? 0 : 1)
