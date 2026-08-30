'use client'

import { useEffect, useRef } from 'react'

import { StepRail, StepFooter, NotYourUnit } from '@/components/chrome'
import { useMoveIn } from './state'
import { formatMoveInDate } from '@/lib/dates'

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

  const moveIn = formatMoveInDate(resident.moveInDate)

  /** Format as they type. A phone number is the one thing they hand-key here. */
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Keep React's state and the actual input in step, whatever put the value
   * there.
   *
   * Chrome autofill writes straight to the DOM, sometimes after mount and
   * sometimes without firing React's synthetic onChange. When that happens the
   * field looks filled, state is still empty, and the button stays disabled
   * with nothing on screen explaining why — the form reads as broken, which is
   * exactly the moment a resident gives up and phones the leasing office.
   *
   * Native listeners catch what React misses; the timers catch autofill that
   * lands after mount and fires nothing at all.
   */
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const sync = () => {
      const formatted = format(el.value)
      if (formatted !== s.mobile) set('mobile', formatted)
    }

    el.addEventListener('input', sync)
    el.addEventListener('change', sync)
    const timers = [0, 150, 400, 900, 1800].map(ms => setTimeout(sync, ms))

    return () => {
      el.removeEventListener('input', sync)
      el.removeEventListener('change', sync)
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.mobile])

  const digits = s.mobile.replace(/\D/g, '').slice(0, 10)
  const ready = digits.length === 10

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
            ref={inputRef}
            onBlur={e => { if (e.target.value !== s.mobile) set('mobile', format(e.target.value)) }}
            className="mi-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(404) 555-0142"
            value={s.mobile}
            onChange={e => set('mobile', format(e.target.value))}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
            {digits.length > 0 && !ready
              ? `${10 - digits.length} more digit${10 - digits.length === 1 ? '' : 's'} to go.`
              : `This is what unlocks the gate from your phone, and where your
                 confirmation goes. We don't use it for marketing.`}
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
