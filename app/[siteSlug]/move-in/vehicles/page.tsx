'use client'

import { StepFooter } from '@/components/chrome'
import { StepNav, StripeMark } from '../nav'
import { useMoveIn } from '../state'
import { CarArt } from '@/components/art'
import type { VehicleDraft } from '@/lib/types'

const EMPTY: VehicleDraft = { plate: '', state: '', make: '', model: '', color: '' }

/**
 * 02 · Add vehicles
 *
 * A vehicle belongs to a person, and only to a person with an active pass —
 * otherwise the gate has a plate it will admit with nobody accountable for it.
 * So this screen is generated from step 1's pass list, not from a fixed form.
 *
 * Only the first pass-holder's vehicle is required. A household with one car
 * and two passes is the normal case, and demanding a second plate would stall
 * activation on something nobody has.
 */
export default function Vehicles() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const holders = ctx.resident.household.filter(m => s.passes.includes(m.id))
  const primary = holders[0]

  const veh = (id: string) => s.vehicles[id] ?? EMPTY
  const setVeh = (id: string, patch: Partial<VehicleDraft>) =>
    set('vehicles', { ...s.vehicles, [id]: { ...veh(id), ...patch } })

  const complete = (v: VehicleDraft) =>
    v.plate.trim().length >= 2 && v.state.trim().length >= 2

  // Required: the person who opened the link. Everyone else is optional, but a
  // half-filled optional vehicle is worse than none — it reaches the gate as a
  // plate with no state.
  const primaryOk = primary ? complete(veh(primary.id)) : false
  const optionalHalfDone = holders.slice(1).some(m => {
    const v = veh(m.id)
    const touched = v.plate.trim() || v.state.trim() || v.make.trim() || v.model.trim()
    return Boolean(touched) && !complete(v)
  })
  const ready = primaryOk && !optionalHalfDone

  const Fields = ({ id }: { id: string }) => {
    const v = veh(id)
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: '0.5rem' }}>
          <div>
            <label className="mi-label" htmlFor={`plate-${id}`}>Plate number</label>
            <input id={`plate-${id}`} className="mi-input" autoCapitalize="characters"
                   placeholder="ABC 1234" value={v.plate}
                   onChange={e => setVeh(id, { plate: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="mi-label" htmlFor={`state-${id}`}>State</label>
            <input id={`state-${id}`} className="mi-input" maxLength={2}
                   autoCapitalize="characters" placeholder="GA" value={v.state}
                   onChange={e => setVeh(id, { state: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
                      marginTop: '0.625rem' }}>
          <div>
            <label className="mi-label" htmlFor={`make-${id}`}>Make</label>
            <input id={`make-${id}`} className="mi-input" placeholder="Honda" value={v.make}
                   onChange={e => setVeh(id, { make: e.target.value })} />
          </div>
          <div>
            <label className="mi-label" htmlFor={`model-${id}`}>Model</label>
            <input id={`model-${id}`} className="mi-input" placeholder="Civic" value={v.model}
                   onChange={e => setVeh(id, { model: e.target.value })} />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <StepNav index={1} />
      <div className="mi-body">
        <h1 className="mi-h1">Add your vehicle information</h1>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          Plate is needed for automatic gate entry. Nothing to pay here.
        </div>

        <div className="mi-art"><CarArt size={132} /></div>

        {holders.map((m, i) => (
          <div key={m.id} className="mi-card mi-card-p"
               style={{ marginBottom: '0.625rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="mi-label" style={{ margin: 0 }}>
                {m.firstName}&apos;s vehicle
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {i === 0 ? 'Required' : 'Optional'}
              </span>
            </div>
            <Fields id={m.id} />
          </div>
        ))}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.875rem' }}>
          Vehicles must belong to people with an active pass from the first step.
          {optionalHalfDone && (
            <span style={{ color: 'var(--warn)', display: 'block', marginTop: '0.25rem' }}>
              One of the optional vehicles is missing a plate or state — finish it
              or clear it.
            </span>
          )}
        </p>

        <details style={{ marginTop: '1rem' }}>
          <summary style={{
            cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--accent-hi)',
            fontWeight: 600, listStyle: 'none',
          }}>
            I don&apos;t have a vehicle
          </summary>
          <div className="mi-hatch" style={{ marginTop: '0.625rem' }}>
            No problem — your phone key still opens the gate on foot, and you can
            add a plate later from your resident app. Tell the leasing office if
            you need a visitor space instead.
            <div style={{ marginTop: '0.625rem' }}>
              <a href={`tel:${ctx.property.leasingPhone}`}>Call {ctx.property.name}</a>
            </div>
          </div>
        </details>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/keys`}
        label={ready ? 'Next: Choose physical keys' : 'Add your plate'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
