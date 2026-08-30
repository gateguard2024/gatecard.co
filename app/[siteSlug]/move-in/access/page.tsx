'use client'

import { StepRail, StepFooter, Check, money } from '@/components/chrome'
import { useMoveIn } from '../state'
import type { CredentialKind } from '@/lib/types'

/**
 * 02 · Access
 *
 * The phone key is free, default and instant — activation must never depend on
 * a card clearing. Fobs and key tags are add-ons; they ship blank and inert and
 * enroll themselves on first tap at the gate (D5), which is why declining one
 * costs the resident nothing but a spare.
 */
export default function Access() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const primary = ctx.credentials.find(c => c.isDefault)!
  const extras = ctx.credentials.filter(c => !c.isDefault)

  const toggle = (k: CredentialKind) =>
    set('extraCredentials',
      s.extraCredentials.includes(k)
        ? s.extraCredentials.filter(x => x !== k)
        : [...s.extraCredentials, k])

  const extrasTotal = extras
    .filter(c => s.extraCredentials.includes(c.kind))
    .reduce((n, c) => n + c.priceCents, 0)

  return (
    <>
      <StepRail index={1} />
      <div className="mi-body">
        <h1 className="mi-h1">How you&apos;ll get in</h1>
        <p className="mi-lede">
          Your phone is your key. It works as soon as you finish these steps —
          you don&apos;t have to wait for anything in the mail.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          {primary.label} is included. Still nothing to pay.
        </div>

        {/* The included credential — presented as settled, not as a choice. */}
        <div className="mi-opt" data-sel="true">
          <span className="mi-tick"><Check /></span>
          <div style={{ flex: 1 }}>
            <div className="mi-opt-title">{primary.label}</div>
            <div className="mi-opt-blurb">{primary.blurb}</div>
          </div>
          <span className="mi-price" data-free="true">Included</span>
        </div>

        <div className="mi-label" style={{ margin: '1.75rem 0 0.625rem' }}>
          Want something physical too?
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0 0 0.875rem' }}>
          Optional. Your phone key works either way.
        </p>

        {extras.map(c => {
          const on = s.extraCredentials.includes(c.kind)
          return (
            <label key={c.kind} className="mi-opt" data-sel={on ? 'true' : 'false'}>
              <input type="checkbox" checked={on} onChange={() => toggle(c.kind)}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
              <span className="mi-tick"><Check /></span>
              <div style={{ flex: 1 }}>
                <div className="mi-opt-title">{c.label}</div>
                <div className="mi-opt-blurb">{c.blurb}</div>
                {c.deliveryNote && <div className="mi-opt-note">{c.deliveryNote}</div>}
              </div>
              <span className="mi-price">{money(c.priceCents)}</span>
            </label>
          )
        })}

        {extrasTotal > 0 && (
          <div className="mi-card mi-card-p" style={{ marginTop: '1rem' }}>
            <div className="mi-fact" style={{ padding: 0 }}>
              <span className="mi-fact-k">Card total, charged at the end</span>
              <span className="mi-fact-v">{money(extrasTotal)}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
              Separate from anything on your lease. If it fails, you keep your access —
              you just don&apos;t get the fob.
            </p>
          </div>
        )}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.25rem' }}>
          Your GateCard photo can wait — add it any time from the app.
        </p>
      </div>

      <StepFooter href={`/${siteSlug}/move-in/parking`} label="Continue" />
    </>
  )
}
