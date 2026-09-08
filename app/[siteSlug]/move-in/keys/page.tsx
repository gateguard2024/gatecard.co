'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark } from '../nav'
import { useMoveIn } from '../state'
import { FobArt, KeyTagArt } from '@/components/art'

/**
 * 03 · Physical keys
 *
 * Backups, and framed as backups. The phone pass from step 1 already opens the
 * gate, so the screen opens by saying so — otherwise a resident reads a price
 * on the third screen of a move-in and assumes access is behind it.
 *
 * The cap is one physical key per person with an active pass. Not a rule
 * invented here: a credential is enrolled against a person in Brivo, and an
 * unassigned fob in a drawer is a key to the community that belongs to nobody.
 * It is shown as a counter rather than enforced silently, because a stepper
 * that stops responding with no explanation reads as broken.
 */

const ART: Record<string, (p: { size: number }) => React.JSX.Element> = {
  fob: FobArt,
  keytag: KeyTagArt,
}

const TITLE: Record<string, string> = { fob: 'Key Fob', keytag: 'Key Tag' }

const BLURB: Record<string, string> = {
  fob: 'A plastic visor fob for your car or bag.',
  keytag: 'A small tag that clips right on your keyring.',
}

export default function Keys() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const holders = ctx.resident.household.filter(m => s.passes.includes(m.id))
  const max = holders.length

  // Only what this property actually issues. Camp Creek sells a fob and no tag;
  // rendering an empty tag card there would be an offer we can't fulfil.
  const options = ctx.credentials.filter(c => c.isPhysical)

  const total = s.keys.fob + s.keys.keytag
  const atCap = total >= max

  const bump = (k: 'fob' | 'keytag', by: number) => {
    const next = Math.max(0, Math.min(s.keys[k] + by, max - (total - s.keys[k])))
    if (next === s.keys[k]) return
    set('keys', { ...s.keys, [k]: next })
  }

  const chosenCents = options.reduce((n, c) => {
    const k = c.kind
    return k === 'fob' || k === 'keytag' ? n + c.priceCents * s.keys[k] : n
  }, 0)

  return (
    <>
      <StepNav index={2} />
      <div className="mi-body">
        <h1 className="mi-h1">Order optional backup keys</h1>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          Phone keys are already active. These are backups.
        </div>

        <div className="mi-counter">
          <span>
            Active passes: <b>{max}</b>
            {holders.length > 0 && ` (${holders.map(m => m.firstName).join(', ')})`}
          </span>
          <span>Physical keys selected: <b>{total}</b> / {max} max</span>
        </div>

        {options.map(c => {
          const k = c.kind as 'fob' | 'keytag'
          const Art = ART[k]
          const qty = s.keys[k]
          return (
            <div key={c.kind} className="mi-prod" data-on={qty > 0 ? 'true' : 'false'}>
              <div className="mi-art-inline">{Art ? <Art size={64} /> : null}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mi-prod-title">{TITLE[k] ?? c.label}</div>
                <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
                  {BLURB[k] ?? c.blurb}
                </p>
                <div className="mi-prod-price">{money(c.priceCents)} one-time</div>

                <div className="mi-step-row" style={{ marginTop: '0.625rem' }}>
                  <button type="button" className="mi-step-btn"
                          onClick={() => bump(k, -1)} disabled={qty === 0}
                          aria-label={`Remove one ${c.label}`}>−</button>
                  <span className="mi-step-val" aria-live="polite">{qty}</span>
                  <button type="button" className="mi-step-btn"
                          onClick={() => bump(k, 1)} disabled={atCap}
                          aria-label={`Add one ${c.label}`}>+</button>
                </div>
              </div>
            </div>
          )
        })}

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginTop: '0.875rem' }}>
          Limit is one physical key (fob or tag) per person with an active pass.
          Max {max} item{max === 1 ? '' : 's'} total for your unit.
          {atCap && (
            <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-3)' }}>
              You&apos;ve reached the limit — remove one to swap it for the other.
            </span>
          )}
        </p>

        <div className="mi-hatch" style={{ marginTop: '1rem' }}>
          Keys ship blank and inert. They activate on the first tap at the gate,
          so one lost in the post is not a key to the community.
        </div>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/services`}
        label={total > 0
          ? `Next: Home Services · ${money(chosenCents)}`
          : 'Next: Home Services'}
      />
      <StripeMark />
    </>
  )
}
