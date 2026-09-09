'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark, PhoneIsYourKey } from '../nav'
import { useMoveIn, vehicleHalfDone } from '../state'
import { AddOnPicker, VehicleFields } from '@/components/move-in-parts'
import { PhoneKeyArt } from '@/components/art'

/**
 * 02 · Your access
 *
 * The primary resident's own setup: their phone key, an optional physical
 * backup, their vehicle, and how they appear at the callbox.
 *
 * The fee is stated here, once, attached to the thing it pays for — the phone
 * key. It is not charged on this screen. Naming the amount next to what it
 * buys is the difference between a fee and a surprise, and it is the last
 * chance to explain it before the household screen where someone might expect
 * a second charge.
 */
export default function YourAccess() {
  const { ctx, s, set, setMember } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

  const me = resident.household.find(m => m.role === 'me')!
  const sel = s.members[me.id]
  const fee = property.parkingFee

  const dir = property.directory
  const dirOn = dir.mode === 'required' ? true : s.directoryListed

  const phoneDigits = s.directoryPhone.replace(/\D/g, '')
  const dirNeedsNumber = dirOn && phoneDigits.length !== 10
  const ready = !vehicleHalfDone(sel) && !dirNeedsNumber

  const fmt = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  const directoryName =
    dir.format === 'full' ? `${resident.firstName} ${resident.lastName}`
    : dir.format === 'unit_only' ? `Unit ${resident.unitNumber}`
    : `${resident.firstName} ${resident.lastName.charAt(0).toUpperCase()}.`

  return (
    <>
      <StepNav index={1} />
      <div className="mi-body">
        <h1 className="mi-h1">Your access</h1>
        <PhoneIsYourKey />

        {/* ── The phone key, and the fee that covers it ─────────────────── */}
        <div className="mi-prod" data-on="true">
          <div className="mi-art-inline"><PhoneKeyArt size={64} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mi-prod-title">Phone key</div>
            <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
              Opens the gate and your building door from your phone. Live the
              moment you finish.
            </p>
            {fee && (
              <div className="mi-prod-price">
                Included in the {money(fee.amountCents)} {fee.label.toLowerCase()}
              </div>
            )}
            {fee && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.375rem 0 0' }}>
                Charged once for Unit {resident.unitNumber} at the last step —
                per unit, not per person.
              </p>
            )}
          </div>
        </div>

        {/* ── Optional physical backup ──────────────────────────────────── */}
        <div className="mi-label" style={{ marginTop: '1.5rem' }}>
          Optional add-on
        </div>
        <AddOnPicker
          credentials={ctx.credentials}
          value={sel.addOn}
          onChange={k => setMember(me.id, { addOn: k })}
          name={resident.firstName}
        />

        {/* ── Vehicle ───────────────────────────────────────────────────── */}
        <div className="mi-label" style={{ marginTop: '1.5rem' }}>
          Your vehicle
        </div>
        <VehicleFields
          id={me.id}
          sel={sel}
          onChange={patch => setMember(me.id, patch)}
          name={resident.firstName}
        />
        {vehicleHalfDone(sel) && (
          <p style={{ fontSize: '0.75rem', color: 'var(--warn)', marginTop: '0.5rem' }}>
            Your vehicle is missing a plate or a state — finish it, or tick
            &ldquo;No vehicle&rdquo;.
          </p>
        )}

        {/* ── Callbox directory ─────────────────────────────────────────── */}
        {dir.mode !== 'hidden' && (
          <>
            <div className="mi-label" style={{ marginTop: '1.5rem' }}>
              Digital directory
            </div>
            <div className="mi-card mi-card-p">
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                            justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mi-opt-title">
                    {dir.mode === 'required' ? 'Listed at the gate' : 'List me at the gate'}
                  </div>
                  <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
                    {dir.note ?? `Guests and couriers find you on the callbox and it
                                  rings your phone. It never affects your own access.`}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mi-switch"
                  checked={dirOn}
                  disabled={dir.mode === 'required'}
                  onChange={e => set('directoryListed', e.target.checked)}
                  aria-label="List me in the digital directory"
                />
              </div>

              {dirOn && (
                <div style={{ marginTop: '0.875rem' }}>
                  <div className="mi-fact" style={{ padding: '0 0 0.625rem', border: 'none' }}>
                    <span className="mi-fact-k">Guests will see</span>
                    <span className="mi-fact-v">{directoryName}</span>
                  </div>
                  <label className="mi-label" htmlFor="dirphone">
                    Number to ring when a guest calls
                  </label>
                  <input
                    id="dirphone"
                    className="mi-input"
                    type="tel"
                    inputMode="numeric"
                    placeholder={s.mobile || '(404) 555-0142'}
                    value={s.directoryPhone}
                    onChange={e => set('directoryPhone', fmt(e.target.value))}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                gap: '0.75rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                      Can be any number — a work line, a partner&apos;s phone.
                    </span>
                    {s.mobile && s.directoryPhone !== s.mobile && (
                      <button type="button" className="mi-chip"
                              onClick={() => set('directoryPhone', s.mobile)}>
                        Use my mobile
                      </button>
                    )}
                  </div>
                  {/* The name is the property's record, not a field. Saying so
                      here prevents a support ticket asking to change it. */}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.625rem 0 0' }}>
                    The name shown comes from your lease and can&apos;t be edited
                    here. You choose whether you appear, and which number rings.
                  </p>
                </div>
              )}

              {!dirOn && dir.mode === 'optional' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.875rem 0 0' }}>
                  You won&apos;t appear at the callbox. Guests and couriers
                  won&apos;t be able to look you up — you&apos;ll need to let them
                  in from your phone.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/household`}
        label={ready ? 'Next: Household access'
          : dirNeedsNumber ? 'Add a directory number'
          : 'Finish your vehicle'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
