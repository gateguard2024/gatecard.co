'use client'

import { money } from '@/components/chrome'
import { useMoveIn, addOnPrice } from '@/app/[siteSlug]/move-in/state'
import { buildReceipt } from '@/lib/receipt'
import { formatMoveInDate } from '@/lib/dates'
import { SCOPE_LABEL } from '@/lib/types'

/**
 * The desktop summary rail.
 *
 * On a phone this flow is a single column and that is correct — a resident is
 * standing in a parking lot holding keys. On a laptop the same column marooned
 * in the middle of a 2000px screen is not a design, it is a phone page that
 * nobody finished.
 *
 * So desktop gets the thing a good checkout has and a form does not: a
 * standing account of what you have chosen and what it will cost, visible
 * while you choose. It never takes input. It is a mirror, not a control.
 */
export function SummaryRail() {
  const { ctx, s } = useMoveIn()
  const { property, resident } = ctx

  const holders = resident.household.filter(m => s.members[m.id]?.pass)

  const receipt = buildReceipt({
    ctx,
    members: s.members,
    serviceIds: s.services,
    requestedIds: s.requested,
    promo: s.promo,
  })

  const ADDON: Record<string, string> = { fob: 'Key fob', keytag: 'Key tag' }

  return (
    <aside className="mi-sum" aria-label="Your move-in so far">
      <div className="mi-sum-card">
        <div className="mi-folio">{property.name}</div>

        <div className="mi-sum-unit">Unit {resident.unitNumber}</div>
        <div className="mi-sum-sub">
          {resident.firstName} {resident.lastName} ·{' '}
          {formatMoveInDate(resident.moveInDate)}
        </div>

        {/* ── Who ────────────────────────────────────────────────────── */}
        <div className="mi-sum-h">Phone keys</div>
        {holders.length === 0 ? (
          <div className="mi-sum-empty">Nobody selected yet</div>
        ) : (
          holders.map(m => {
            const sel = s.members[m.id]
            const price = addOnPrice(ctx, sel.addOn)
            return (
              <div key={m.id} className="mi-sum-row">
                <span>
                  {m.firstName}
                  {sel.addOn !== 'none' && (
                    <span className="mi-sum-note"> · {ADDON[sel.addOn]}</span>
                  )}
                </span>
                <span className="mi-sum-amt">
                  {price > 0 ? money(price) : '—'}
                </span>
              </div>
            )
          })
        )}

        {/* ── What it opens ──────────────────────────────────────────── */}
        <div className="mi-sum-h">Opens</div>
        {property.access.alwaysGranted.map(sc => (
          <div key={sc} className="mi-sum-row">
            <span>{SCOPE_LABEL[sc]}</span>
            <span className="mi-sum-note">Always</span>
          </div>
        ))}
        {property.access.feeUnlocks.map(sc => (
          <div key={sc} className="mi-sum-row">
            <span>{SCOPE_LABEL[sc]}</span>
            <span className="mi-sum-note">With the fee</span>
          </div>
        ))}

        {/* ── Money ──────────────────────────────────────────────────── */}
        <div className="mi-sum-total">
          <span>Due at the last step</span>
          <b>{money(receipt.dueTodayCents)}</b>
        </div>
        {receipt.monthlyCents > 0 && (
          <div className="mi-sum-row" style={{ borderBottom: 'none' }}>
            <span className="mi-sum-note">Monthly after move-in</span>
            <span className="mi-sum-amt">{money(receipt.monthlyCents)}/mo</span>
          </div>
        )}

        <p className="mi-sum-foot">
          Nothing is charged until you finish the last step.
        </p>
      </div>
    </aside>
  )
}
