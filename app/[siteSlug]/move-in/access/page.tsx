'use client'

import { StepFooter, Check, money } from '@/components/chrome'
import { StepNav } from '../nav'
import { useMoveIn } from '../state'
import type { CredentialKind, DirectoryNameFormat } from '@/lib/types'

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
      <StepNav index={1} />
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

        <DirectorySection />

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.25rem' }}>
          Your GateCard photo can wait — add it any time from the app.
        </p>
      </div>

      <StepFooter href={`/${siteSlug}/move-in/parking`} label="Continue" />
    </>
  )
}


/**
 * How visitors reach you at the callbox.
 *
 * A privacy control, and the reason it sits on this screen rather than a new
 * one: the three-step activation promise is worth more than tidy grouping, and
 * this belongs with "how you get in" because it is the same door.
 *
 * Two things it must never do. It must not affect access — an unlisted
 * resident opens the gate exactly like a listed one. And it must not silently
 * strand deliveries: opting out says plainly what stops working, because a
 * resident who discovers it via a missed package blames the building.
 */
function DirectorySection() {
  const { ctx, s, set } = useMoveIn()
  const policy = ctx.property.directory

  // Some properties run no directory at all.
  if (policy.mode === 'hidden') return null

  const { firstName, lastName, unitNumber } = ctx.resident
  const preview = (f: DirectoryNameFormat) =>
    f === 'full' ? `${firstName} ${lastName}`
    : f === 'last_initial' ? `${firstName} ${lastName.charAt(0).toUpperCase()}.`
    : `Unit ${unitNumber}`

  const LABEL: Record<DirectoryNameFormat, string> = {
    full: 'My full name',
    last_initial: 'First name and last initial',
    unit_only: 'Just my unit number',
  }

  const required = policy.mode === 'required'
  const listed = required || s.directoryListed

  return (
    <>
      <div className="mi-label" style={{ margin: '1.75rem 0 0.625rem' }}>
        How visitors reach you
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0 0 0.875rem' }}>
        The callbox at the gate has a directory guests search to call you.
        {policy.note ? ` ${policy.note}` : ''}
      </p>

      {required ? (
        <div className="mi-card mi-card-p">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="mi-opt-title" style={{ flex: 1 }}>Listed in the directory</span>
            <span className="mi-badge" data-tone="req">Required here</span>
          </div>
          <div className="mi-opt-blurb">
            {ctx.property.name} lists every resident. You can still choose how your
            name appears.
          </div>
        </div>
      ) : (
        <>
          <label className="mi-opt" data-sel={listed ? 'true' : 'false'}>
            <input type="radio" name="dir" checked={listed}
                   onChange={() => set('directoryListed', true)}
                   style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <span className="mi-tick"><Check /></span>
            <div style={{ flex: 1 }}>
              <div className="mi-opt-title">List me</div>
              <div className="mi-opt-blurb">
                Guests and couriers can find you at the callbox and ring your phone.
              </div>
            </div>
          </label>

          <label className="mi-opt" data-sel={!listed ? 'true' : 'false'}>
            <input type="radio" name="dir" checked={!listed}
                   onChange={() => set('directoryListed', false)}
                   style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <span className="mi-tick"><Check /></span>
            <div style={{ flex: 1 }}>
              <div className="mi-opt-title">Keep me off the directory</div>
              <div className="mi-opt-blurb">
                Nobody can look you up at the gate.
              </div>
              {!listed && (
                <div className="mi-opt-note" style={{ color: 'var(--warn)' }}>
                  Couriers and guests won&apos;t be able to reach you from the callbox —
                  you&apos;ll need to let them in from your phone, or give them your
                  unit number in advance. Your own access is unaffected.
                </div>
              )}
            </div>
          </label>
        </>
      )}

      {listed && policy.formats.length > 1 && (
        <>
          <div className="mi-label" style={{ margin: '1.25rem 0 0.5rem' }}>
            How your name appears
          </div>
          {policy.formats.map(f => (
            <label key={f} className="mi-opt"
                   data-sel={s.directoryFormat === f ? 'true' : 'false'}>
              <input type="radio" name="dirfmt" checked={s.directoryFormat === f}
                     onChange={() => set('directoryFormat', f)}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
              <span className="mi-tick"><Check /></span>
              <div style={{ flex: 1 }}>
                <div className="mi-opt-title">{LABEL[f]}</div>
                {/* What a visitor actually sees, rather than a description of it. */}
                <div className="mi-opt-note" style={{ fontFamily: 'ui-monospace, monospace' }}>
                  Shows as “{preview(f)}”
                </div>
              </div>
            </label>
          ))}
        </>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.875rem' }}>
        You can change this any time, and it never affects whether your key works.
      </p>
    </>
  )
}
