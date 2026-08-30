'use client'

import { StepRail, StepFooter, NotYourUnit } from '@/components/chrome'
import { useMoveIn } from './state'

/**
 * 01 · Arrival
 *
 * Confirm identity, unit and move-in date — all pre-filled from the roster.
 * Exactly one editable field: the mobile number, because that is the one thing
 * the sync most often lacks and the one thing everything downstream needs.
 *
 * No payment here, and the screen says so out loud. A resident who believes
 * they are about to be charged abandons.
 */
export default function Arrival() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

  const moveIn = new Date(resident.moveInDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const digits = s.mobile.replace(/\D/g, '').slice(0, 10)
  const ready = digits.length === 10

  /** Format as they type. A phone number is the one thing they hand-key here. */
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  return (
    <>
      <StepRail index={0} />
      <div className="mi-body">
        <h1 className="mi-h1">Welcome home, {resident.firstName}.</h1>
        <p className="mi-lede">
          Let&apos;s get your access working before you carry the first box in.
          Three short steps, about two minutes.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          Nothing to pay on this screen or the next two.
        </div>

        <div className="mi-card mi-card-p">
          <div className="mi-fact">
            <span className="mi-fact-k">Name</span>
            <span className="mi-fact-v">{resident.firstName} {resident.lastName}</span>
          </div>
          <div className="mi-fact">
            <span className="mi-fact-k">Unit</span>
            <span className="mi-fact-v">{resident.unitNumber}</span>
          </div>
          <div className="mi-fact">
            <span className="mi-fact-k">Move-in</span>
            <span className="mi-fact-v">{moveIn}</span>
          </div>
          {resident.email && (
            <div className="mi-fact">
              <span className="mi-fact-k">Email</span>
              <span className="mi-fact-v">{resident.email}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <label className="mi-label" htmlFor="mobile">Your mobile number</label>
          <input
            id="mobile"
            className="mi-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(404) 555-0142"
            value={s.mobile}
            onChange={e => set('mobile', format(e.target.value))}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
            This is what unlocks the gate from your phone, and where your
            confirmation goes. We don&apos;t use it for marketing.
          </p>
        </div>

        {resident.householdMembers.length > 0 && (
          <div className="mi-card mi-card-p" style={{ marginTop: '1.25rem' }}>
            <div className="mi-label" style={{ marginBottom: '0.5rem' }}>Also on your lease</div>
            {resident.householdMembers.map(m => (
              <div key={m.firstName} style={{ fontSize: '0.875rem' }}>
                {m.firstName} {m.lastName}
              </div>
            ))}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
              They&apos;ll get their own link — access is never shared between people.
            </p>
          </div>
        )}

        <NotYourUnit property={property} />
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/access`}
        label={ready ? 'Continue' : 'Add your mobile number'}
        disabled={!ready}
      />
    </>
  )
}
