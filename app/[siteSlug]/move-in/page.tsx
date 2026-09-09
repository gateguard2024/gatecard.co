'use client'

import { useEffect, useRef } from 'react'
import { StepFooter, NotYourUnit } from '@/components/chrome'
import { StepNav, StripeMark } from './nav'
import { useMoveIn } from './state'
import { formatMoveInDate } from '@/lib/dates'

/**
 * 01 · Welcome
 *
 * Confirm who this is, and capture the two things the roster reliably lacks or
 * gets stale: a mobile number and a working email.
 *
 * Name, unit and move-in date are READ ONLY. They come from the property's
 * roster, and a resident editing them here would put our record out of step
 * with the lease — so the screen says where to go instead. That is a feature:
 * the leasing office owns identity, we own access.
 *
 * The email matters more than it looks. A Brivo mobile pass cannot be issued to
 * a user without one, so a wrong address here is a resident standing at a gate
 * that will not open. It is confirmed explicitly rather than assumed.
 */
export default function Welcome() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

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
  const ready = digits.length === 10 && s.emailConfirmed

  const others = resident.household.filter(m => m.role !== 'me')
  const ROLE: Record<string, string> = {
    leaseholder: 'Leaseholder', occupant: 'Occupant', me: 'You',
  }
  const isRenewal = resident.leaseTermMonths !== null && resident.mobile !== null

  return (
    <>
      <StepNav index={0} />
      <div className="mi-body">
        <h1 className="mi-h1">Welcome home, {resident.firstName}.</h1>
        <p className="mi-lede">
          Let&apos;s get your access working before you carry the first box in.
          Five short steps, about two minutes.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          Nothing to pay on this screen or the next three. Your keys go live when
          you finish the last one.
        </div>

        {/* ── From the roster. Not editable here, and the screen says why. ── */}
        <div className="mi-label">From your lease</div>
        <div className="mi-card">
          <div className="mi-fact mi-card-p">
            <span className="mi-fact-k">Primary resident</span>
            <span className="mi-fact-v">{resident.firstName} {resident.lastName}</span>
          </div>
          <div className="mi-fact mi-card-p">
            <span className="mi-fact-k">Unit</span>
            <span className="mi-fact-v">{resident.unitNumber}</span>
          </div>
          <div className="mi-fact mi-card-p">
            <span className="mi-fact-k">{isRenewal ? 'Renewal date' : 'Move-in date'}</span>
            <span className="mi-fact-v">{formatMoveInDate(resident.moveInDate)}</span>
          </div>
          <div className="mi-fact mi-card-p">
            <span className="mi-fact-k">Email</span>
            <span className="mi-fact-v">{resident.email ?? '—'}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
          Your name, unit, date and email come from your lease. If any of it is
          wrong, the leasing office has to change it — we can&apos;t.{' '}
          <a href={`tel:${property.leasingPhone}`} style={{ color: 'var(--accent-hi)', fontWeight: 600 }}>
            Call {property.name}
          </a>
        </p>

        <label className="mi-opt" data-sel={s.emailConfirmed ? 'true' : 'false'}
               style={{ marginTop: '0.875rem' }}>
          <input type="checkbox" checked={s.emailConfirmed}
                 onChange={e => set('emailConfirmed', e.target.checked)}
                 style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
          <span className="mi-tick">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div style={{ flex: 1 }}>
            <div className="mi-opt-title">That email is correct</div>
            <div className="mi-opt-blurb">
              Your phone key is issued to this address. A wrong one means a gate
              that won&apos;t open.
            </div>
          </div>
        </label>

        {/* ── Mobile ─────────────────────────────────────────────────────── */}
        <div style={{ marginTop: '1.25rem' }}>
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
            {digits.length > 0 && digits.length < 10
              ? `${10 - digits.length} more digit${10 - digits.length === 1 ? '' : 's'} to go.`
              : 'We use this to open the gate and send your confirmation. No marketing.'}
          </p>
        </div>

        {/* ── Who else is on the lease. Display only — passes come later. ── */}
        {others.length > 0 && (
          <>
            <div className="mi-label" style={{ marginTop: '1.5rem' }}>
              Also on your lease
            </div>
            <div className="mi-card">
              {others.map((m, i) => (
                <div key={m.id} className="mi-fact mi-card-p"
                     style={{ borderTop: i ? '1px solid var(--line)' : undefined }}>
                  <span className="mi-fact-k">{m.firstName} {m.lastName}</span>
                  <span className="mi-fact-v" style={{ fontSize: '0.8125rem',
                                                       color: 'var(--text-3)' }}>
                    {m.alreadyActive ? 'Already has access' : ROLE[m.role]}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
              You&apos;ll choose who gets a phone key in step 3.
            </p>
          </>
        )}

        <NotYourUnit property={property} />
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/access`}
        label={ready ? 'Next: Your access'
          : !s.emailConfirmed ? 'Confirm your email'
          : 'Add your mobile number'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
