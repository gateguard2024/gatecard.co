'use client'

import Link from 'next/link'
import { StepRail, Check, money } from '@/components/chrome'
import { useMoveIn } from '../state'

/**
 * 04 · Services
 *
 * Activation is already done. The screen opens by saying so, because the whole
 * point of the ordering is that nothing optional can hold up a working key.
 *
 * Every card here is offer-engine output (D7). Four modes:
 *   included    — bulk ROE at this property. The card becomes an activation
 *                 helper, not a purchase. Never a price, never a cart.
 *   sellable    — orderable; commission tracked
 *   quote       — configurator, deposit + monitoring (FORGE, reused)
 *   unavailable — not rendered at all
 *
 * Nothing about East Ponds is coded here. Change the table, change the screen.
 */
export default function Services() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const offers = ctx.services.filter(o => o.mode !== 'unavailable')

  const request = (id: string) =>
    set('requested', s.requested.includes(id)
      ? s.requested.filter(x => x !== id)
      : [...s.requested, id])

  const toggle = (id: string) =>
    set('services', s.services.includes(id)
      ? s.services.filter(x => x !== id)
      : [...s.services, id])

  return (
    <>
      <StepRail index={3} />
      <div className="mi-body">
        <div className="mi-free" style={{ marginTop: '0.5rem' }}>
          <span aria-hidden>✓</span>
          Your access is live. Unit {ctx.resident.unitNumber} — you can stop here.
        </div>

        <h1 className="mi-h1">A few things people set up now</h1>
        <p className="mi-lede">
          All optional, and all easier today than in three weeks. Skip anything.
        </p>

        {offers.map(o => {
          // Sellable offers are ticked; included and quote offers are requested
          // by button. One flag either way, so the card reads the same.
          const on = o.mode === 'sellable'
            ? s.services.includes(o.id)
            : s.requested.includes(o.id)

          // Already covered by the lease — an activation helper, not a purchase.
          if (o.mode === 'included') {
            return (
              <div key={o.id} className="mi-card mi-card-p" style={{ marginBottom: '0.625rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div>
                    <div className="mi-opt-title">{o.name}</div>
                    <div className="mi-opt-blurb">{o.blurb}</div>
                  </div>
                  <span className="mi-badge" data-tone="ok">Included</span>
                </div>
                <button
                  className={on ? 'mi-btn' : 'mi-btn mi-btn-2'}
                  style={{ marginTop: '0.875rem' }}
                  onClick={() => request(o.id)}
                >
                  {on ? '\u2713  Activation requested' : o.ctaLabel}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                  {on
                    ? 'We\u2019ll have it live for your move-in date. Tap again to cancel.'
                    : o.includedReason}
                </p>
              </div>
            )
          }

          // Configurator branch — a quote, not a cart.
          if (o.mode === 'quote') {
            return (
              <div key={o.id} className="mi-card mi-card-p" style={{ marginBottom: '0.625rem' }}>
                <div className="mi-opt-title">{o.name}</div>
                <div className="mi-opt-blurb">{o.blurb}</div>
                <button
                  className={on ? 'mi-btn' : 'mi-btn mi-btn-2'}
                  style={{ marginTop: '0.875rem' }}
                  onClick={() => request(o.id)}
                >
                  {on ? '\u2713  Consultation requested' : o.ctaLabel}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                  {on
                    ? 'Someone will call to size it up. Nothing is charged until you approve a quote.'
                    : 'Takes about a minute, and nothing is charged today.'}
                </p>
              </div>
            )
          }

          // Orderable.
          return (
            <label key={o.id} className="mi-opt" data-sel={on ? 'true' : 'false'}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.id)}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
              <span className="mi-tick"><Check /></span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem', flexWrap: 'wrap' }}>
                  <span className="mi-opt-title">{o.name}</span>
                  {o.leaseRequired && <span className="mi-badge" data-tone="req">Lease requires it</span>}
                </div>
                <div className="mi-opt-blurb">{o.blurb}</div>
                <div className="mi-opt-note">{o.provider}</div>
              </div>
              {o.monthlyCents !== null && (
                <span className="mi-price">{money(o.monthlyCents)}/mo</span>
              )}
            </label>
          )
        })}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.25rem' }}>
          Anything you skip stays available in your resident app.
        </p>
      </div>

      <div className="mi-foot">
        <Link href={`/${siteSlug}/move-in/store`} className="mi-btn">Continue</Link>
        <Link href={`/${siteSlug}/move-in/confirmation`} className="mi-skip">
          Skip — I&apos;m done
        </Link>
      </div>
    </>
  )
}
