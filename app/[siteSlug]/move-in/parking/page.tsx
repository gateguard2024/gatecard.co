'use client'

import { useParams } from 'next/navigation'
import { getMoveInContext } from '@/lib/mock/east-ponds'
import { StepRail, StepFooter, Check, money } from '@/components/chrome'
import { useMoveIn } from '../state'

/**
 * 03 · Parking
 *
 * Last of the three activation screens, and still no checkout. Upgrades are
 * recurring charges whose collection path is unresolved (D3), so the screen
 * commits to nothing beyond "this is added to your lease" — deliberately vague
 * copy that stays true under any of the live options.
 *
 * Inventory counts are real. A tier at zero renders visibly, disabled, with a
 * waitlist — hiding it makes the resident ask the leasing office instead.
 */
export default function Parking() {
  const { siteSlug } = useParams<{ siteSlug: string }>()
  const ctx = getMoveInContext(siteSlug)!
  const { s, set } = useMoveIn()

  const chosen = s.parkingTierId || ctx.parkingTiers.find(t => t.included)?.id || ''
  const tier = ctx.parkingTiers.find(t => t.id === chosen)
  const v = s.vehicle
  const ready = v.plate.trim().length >= 2 && v.state.trim().length >= 2

  return (
    <>
      <StepRail index={2} />
      <div className="mi-body">
        <h1 className="mi-h1">Where you&apos;ll park</h1>
        <p className="mi-lede">
          So the gate knows your car and you don&apos;t get towed in week one.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          No card needed. Upgrades are added to your lease.
        </div>

        {ctx.parkingTiers.map(t => {
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

        {tier && !tier.included && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.875rem 0 0' }}>
            {money(tier.monthlyCents)} a month is added to your lease, not charged to a
            card today.
          </p>
        )}

        <div className="mi-label" style={{ margin: '1.75rem 0 0.75rem' }}>Your vehicle</div>

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
        label={ready ? 'Finish setup' : 'Add your plate'}
        disabled={!ready}
      />
    </>
  )
}
