'use client'

import { useEffect, useRef } from 'react'
import { StepFooter, NotYourUnit, Check, money } from '@/components/chrome'
import { StepNav, StripeMark } from './nav'
import { useMoveIn } from './state'
import { computeFee } from '@/lib/fees'

/**
 * 01 · Who you are
 *
 * Two jobs: confirm who on the lease gets a phone pass, and capture the one
 * field the roster reliably lacks — a mobile number.
 *
 * The fee is shown as INCLUDED WITH THE UNIT rather than as a price. It is
 * written into the lease, so leading with a dollar figure on the welcome screen
 * frames a lease term as a charge the resident is about to incur.
 *
 * Granting a pass to someone else is a real act: one adult is provisioning
 * building access for another. It is deliberately explicit, one card per person,
 * rather than a checkbox in a list.
 */
export default function WhoYouAre() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

  const fee = computeFee({
    fee: property.parkingFee,
    concession: resident.concession,
    termMonths: resident.leaseTermMonths,
  })

  /** Format as they type. A phone number is the one thing they hand-key here. */
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  const inputRef = useRef<HTMLInputElement>(null)

  // Chrome autofill writes straight to the DOM, sometimes after mount and
  // sometimes without firing React's onChange. Without this the field looks
  // filled while state is empty and the button stays dead for no visible
  // reason — which reads as a broken form.
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

  const me = resident.household.find(m => m.role === 'me')
  const others = resident.household.filter(m => m.role !== 'me')

  const toggle = (id: string) =>
    set('passes', s.passes.includes(id)
      ? s.passes.filter(x => x !== id)
      : [...s.passes, id])

  const initials = (f: string, l: string) =>
    `${f.charAt(0)}${l.charAt(0)}`.toUpperCase()

  const ROLE: Record<string, string> = {
    me: '(Me)', leaseholder: '(Leaseholder)', occupant: '(Occupant)',
  }

  return (
    <>
      <StepNav index={0} />
      <div className="mi-body">
        <h1 className="mi-h1">Welcome home, {resident.firstName}.</h1>
        <p className="mi-lede">Let&apos;s get your gate ready. 2 minutes.</p>

        {fee && (fee.fullyCovered ? (
          <div className="mi-free" style={{ display: 'block' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span aria-hidden>✓</span>
              <span>Included with Unit {resident.unitNumber}:</span>
            </div>
            <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', fontWeight: 600 }}>
              {property.parkingFee!.label.replace(/\s*fee$/i, ' access')}
            </div>
          </div>
        ) : (
          /* One charge for the unit, not per person — said here, before anyone
             hesitates over adding a pass for their partner. */
          <div className="mi-note">
            <div className="mi-note-row">
              <span>{property.parkingFee!.label} · Unit {resident.unitNumber}</span>
              <b>{money(fee.netCents)}</b>
            </div>
            <p>
              {property.parkingFee!.covers}. Charged once at sign-up for the whole
              unit{fee.partiallyCovered
                ? `, after ${money(fee.coveredCents)} covered by ${property.name}`
                : ''} — not per person.
            </p>
          </div>
        ))}

        <div className="mi-label" style={{ margin: '1.5rem 0 0.625rem' }}>
          Who gets a phone pass
        </div>

        <div className="mi-people" data-one={others.length === 0 ? 'true' : 'false'}>
          {me && (
            <div className="mi-person" data-on="true">
              <div className="mi-avatar">{initials(me.firstName, me.lastName)}</div>
              <div className="mi-person-name">{me.firstName}</div>
              <div className="mi-person-role">{ROLE.me}</div>
              <div className="mi-person-action">
                <div className="mi-check-round"><Check /></div>
                <div className="mi-person-label">Activate phone key</div>
                <div className="mi-person-sub">(Included)</div>
              </div>
            </div>
          )}

          {others.map(m => {
            const on = s.passes.includes(m.id)
            return (
              <div key={m.id} className="mi-person" data-on={on ? 'true' : 'false'}>
                <div className="mi-avatar">{initials(m.firstName, m.lastName)}</div>
                <div className="mi-person-name">{m.firstName}</div>
                <div className="mi-person-role">{ROLE[m.role]}</div>
                <div className="mi-person-action">
                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <input
                      type="checkbox"
                      className="mi-switch"
                      checked={on}
                      disabled={m.alreadyActive}
                      onChange={() => toggle(m.id)}
                      aria-label={`${on ? 'Remove' : 'Add'} phone key for ${m.firstName}`}
                    />
                  </div>
                  <div className="mi-person-label">
                    {m.alreadyActive ? 'Already active' : 'Add phone key'}
                  </div>
                  <div className="mi-person-sub">
                    {m.alreadyActive ? '(On the roster)' : '(No extra charge)'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <label className="mi-label" htmlFor="mobile">Your mobile number</label>
          <input
            id="mobile"
            ref={inputRef}
            className="mi-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(404) 555-0142"
            value={s.mobile}
            onBlur={e => { if (e.target.value !== s.mobile) set('mobile', format(e.target.value)) }}
            onChange={e => set('mobile', format(e.target.value))}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
            {digits.length > 0 && !ready
              ? `${10 - digits.length} more digit${10 - digits.length === 1 ? '' : 's'} to go.`
              : `Add ${resident.firstName}’s mobile number. We use this to open the
                 gate and send confirmation. No marketing.`}
          </p>
        </div>

        {/* A required field with no alternative is a dead end. Not everyone has
            a mobile, and some won't give one to a vendor. */}
        <details style={{ marginTop: '1rem' }}>
          <summary style={{
            cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--accent-hi)',
            fontWeight: 600, listStyle: 'none',
          }}>
            I don&apos;t have a mobile number
          </summary>
          <div className="mi-hatch" style={{ marginTop: '0.625rem' }}>
            Your phone key needs a mobile number, but you don&apos;t have to use one.
            The leasing office can issue a fob or key tag at handover instead — it
            works at the gate exactly the same way.
            <div style={{ marginTop: '0.625rem' }}>
              <a href={`tel:${property.leasingPhone}`}>Call {property.name}</a>
            </div>
          </div>
        </details>

        <NotYourUnit property={property} />
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/vehicles`}
        label={ready ? 'Next: Add vehicles' : 'Add your mobile number'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
