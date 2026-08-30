'use client'

import { StepFooter, Check, money } from '@/components/chrome'
import { StepNav } from '../nav'
import { useMoveIn } from '../state'
import { computeFee } from '@/lib/fees'
import { formatMoveInDate } from '@/lib/dates'

/**
 * 03 · Parking
 *
 * Two shapes, decided by data rather than a flag:
 *
 *   No tiers configured  → pure vehicle registration. This is the common case:
 *                          the property just needs the plate so the gate knows
 *                          the car and nobody gets towed in week one.
 *   Tiers configured     → the resident also picks a space type.
 *
 * A property that doesn't sell covered or garage spaces has no tier rows, and
 * the picker disappears on its own. Nothing here knows which properties those
 * are, which is the same rule the offer engine follows.
 *
 * Last of the three activation screens, and still no checkout. Where tiers do
 * exist, their collection path is unresolved (D3), so the copy commits to
 * nothing beyond "part of your lease".
 *
 * Inventory counts are real. A tier at zero renders visibly, disabled, with a
 * waitlist — hiding it makes the resident ask the leasing office instead.
 */
export default function Parking() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const fee = computeFee({
    fee: ctx.property.parkingFee,
    concession: ctx.resident.concession,
    termMonths: ctx.resident.leaseTermMonths,
  })

  const tiersOffered = ctx.parkingTiers.length > 0
  const chosen = s.parkingTierId || ctx.parkingTiers.find(t => t.included)?.id || ''
  const tier = ctx.parkingTiers.find(t => t.id === chosen)
  const v = s.vehicle

  // Where tiers exist and none is included there is nothing to preselect, so
  // the resident has to choose — otherwise the screen advances with no parking
  // at all and looks like it worked. Where no tiers exist, only the plate
  // matters.
  const hasTier = !tiersOffered || Boolean(tier)
  const hasPlate = v.plate.trim().length >= 2 && v.state.trim().length >= 2
  const ready = hasTier && hasPlate

  return (
    <>
      <StepNav index={2} />
      <div className="mi-body">
        <h1 className="mi-h1">
          {tiersOffered ? 'Where you\u2019ll park' : 'Your vehicle'}
        </h1>
        <p className="mi-lede">
          So the gate knows your car and you don&apos;t get towed in week one.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          {!tiersOffered
            ? 'No card needed on this screen.'
            : ctx.parkingTiers.some(t => t.included)
              ? 'No card needed here. Upgrades are part of your lease.'
              : 'No card needed here. Parking is billed as part of your lease.'}
        </div>

        {/*
          The fee to park inside the gates. Stated, not offered — it is written
          into the lease, so presenting it as a choice would be a lie, and
          burying it would be worse.
        */}
        {fee && (
          <div className="mi-card mi-card-p">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          gap: '0.75rem', alignItems: 'baseline' }}>
              <span className="mi-opt-title">{ctx.property.parkingFee!.label}</span>
              <span className="mi-price"
                    data-free={fee.fullyCovered ? 'true' : 'false'}>
                {fee.fullyCovered ? 'Covered' : `${money(fee.netCents)}/mo`}
              </span>
            </div>

            {ctx.property.parkingFee!.covers && (
              <div className="mi-opt-blurb">{ctx.property.parkingFee!.covers}</div>
            )}

            {/* A concession the resident can't see is one they can't be
                grateful for, and one nobody can query when it lapses. */}
            {fee.coveredCents > 0 && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem',
                            borderTop: '1px solid var(--line)' }}>
                <div className="mi-fact" style={{ padding: '0.1875rem 0' }}>
                  <span className="mi-fact-k">Fee</span>
                  <span className="mi-fact-v">{money(fee.baseCents)}/mo</span>
                </div>
                <div className="mi-fact" style={{ padding: '0.1875rem 0', border: 'none' }}>
                  <span className="mi-fact-k" style={{ color: 'var(--ok)' }}>
                    {ctx.resident.concession!.label}
                  </span>
                  <span className="mi-fact-v" style={{ color: 'var(--ok)' }}>
                    −{money(fee.coveredCents)}/mo
                  </span>
                </div>
                <div className="mi-fact" style={{ padding: '0.375rem 0 0' }}>
                  <span className="mi-fact-k">You pay</span>
                  <span className="mi-fact-v">
                    {fee.netCents === 0 ? 'Nothing' : `${money(fee.netCents)}/mo`}
                  </span>
                </div>
              </div>
            )}

            {/* The payment going UP partway through a lease is the single most
                complaint-generating thing here. Say it now. */}
            {fee.revertsOn && (
              <div className="mi-opt-note" style={{ color: 'var(--warn)' }}>
                This covers your first {ctx.resident.concession!.months} months.
                From {formatMoveInDate(fee.revertsOn)} the fee returns to{' '}
                {money(fee.revertsCents!)}/mo.
              </div>
            )}

            <div className="mi-opt-note">
              Part of your lease at {ctx.property.name}. Nothing is charged here,
              and no card is kept on file for it.
              {fee.shortTerm && ctx.resident.leaseTermMonths
                ? ` Your lease runs ${ctx.resident.leaseTermMonths} months.`
                : ''}
            </div>
          </div>
        )}

        {tiersOffered && ctx.parkingTiers.map(t => {
          const out = t.spacesAvailable === 0
          const on = t.id === chosen
          return (
            <label key={t.id} className="mi-opt"
                   data-sel={on ? 'true' : 'false'}
                   aria-disabled={out ? 'true' : 'false'}>
              <input type="radio" name="tier" checked={on} disabled={out}
                     onChange={() => set('parkingTierId', t.id)}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
              <span className="mi-tick"><Check /></span>
              <div style={{ flex: 1 }}>
                <div className="mi-opt-title">{t.label}</div>
                <div className="mi-opt-blurb">{t.blurb}</div>
                <div className="mi-opt-note">
                  {out
                    ? 'None available right now — the leasing office keeps a waitlist'
                    : `${t.spacesAvailable} available`}
                </div>
              </div>
              <span className="mi-price" data-free={t.included ? 'true' : 'false'}>
                {t.included ? 'Included' : `${money(t.monthlyCents)}/mo`}
              </span>
            </label>
          )
        })}

        {tiersOffered && tier && !tier.included && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.875rem 0 0' }}>
            {money(tier.monthlyCents)} a month, as part of your lease. Nothing is charged
            to a card here.
          </p>
        )}

        <div className="mi-label" style={{ margin: '1.75rem 0 0.75rem' }}>
          Your vehicle
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: '0.625rem' }}>
          <div>
            <label className="mi-label" htmlFor="plate">Plate</label>
            <input id="plate" className="mi-input" autoCapitalize="characters"
                   placeholder="ABC 1234" value={v.plate}
                   onChange={e => set('vehicle', { ...v, plate: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="mi-label" htmlFor="pstate">State</label>
            <input id="pstate" className="mi-input" maxLength={2} autoCapitalize="characters"
                   placeholder="GA" value={v.state}
                   onChange={e => set('vehicle', { ...v, state: e.target.value.toUpperCase() })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginTop: '0.75rem' }}>
          <div>
            <label className="mi-label" htmlFor="make">Make</label>
            <input id="make" className="mi-input" placeholder="Honda" value={v.make}
                   onChange={e => set('vehicle', { ...v, make: e.target.value })} />
          </div>
          <div>
            <label className="mi-label" htmlFor="model">Model</label>
            <input id="model" className="mi-input" placeholder="Civic" value={v.model}
                   onChange={e => set('vehicle', { ...v, model: e.target.value })} />
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.875rem' }}>
          You can add a second vehicle later. One is enough to get you through the gate.
        </p>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/services`}
        label={
          !hasTier ? 'Choose where you\'ll park'
          : !hasPlate && !tiersOffered ? 'Add your plate'
          : !hasPlate ? 'Add your plate'
          : 'Finish setup'
        }
        disabled={!ready}
      />
    </>
  )
}
