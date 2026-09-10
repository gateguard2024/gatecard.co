'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark, PhoneIsYourKey } from '../nav'
import { useMoveIn, vehicleSettled, vehicleMissing, missingPhrase } from '../state'
import { AddOnPicker, VehicleFields } from '@/components/move-in-parts'
import { PhoneKeyArt } from '@/components/art'
import { SCOPE_LABEL } from '@/lib/types'

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

  const always = property.access.alwaysGranted
  const unlocks = property.access.feeUnlocks

  const dir = property.directory
  const dirOn = dir.mode === 'required' ? true : s.directoryListed

  const phoneDigits = s.directoryPhone.replace(/\D/g, '')
  const dirNeedsNumber = dirOn && phoneDigits.length !== 10

  // A vehicle is all four fields or an explicit "No vehicle". There is no
  // third state where a plate reaches the gate with nothing attached to it.
  const vehicleOk = vehicleSettled(sel)
  const missing = vehicleMissing(sel.vehicle)
  const ready = vehicleOk && !dirNeedsNumber

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
              Opens the gate and your building door from your phone.
            </p>
            {fee && (
              <div className="mi-prod-price">
                Included in the {money(fee.amountCents)} {fee.label.toLowerCase()}
              </div>
            )}
            {fee && (
              /* Said here, plainly, on the screen where the fee first appears.
                 The alternative is a resident discovering it at checkout, which
                 is the worst possible moment to learn that the thing they came
                 for is behind a payment. */
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.375rem 0 0' }}>
                Charged once for Unit {resident.unitNumber}, not per person, and
                paid in full for twelve months.
              </p>
            )}
          </div>
        </div>

        {/* ── What the key opens, and what the fee unlocks ──────────────
            Shown as two lists rather than one, because the difference is the
            whole shape of the deal: walking home is never behind a payment,
            and driving in is exactly what the fee buys. A resident who can see
            that also understands why the charge exists. */}
        <div className="mi-label" style={{ marginTop: '1.5rem' }}>
          What your phone key opens
        </div>
        <div className="mi-card">
          {always.map((sc, i) => (
            <div key={sc} className="mi-card-p"
                 style={{ borderTop: i ? '1px solid var(--line)' : 'none',
                          display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <span className="mi-dot" data-s="working_now" />
              <span style={{ flex: 1, fontSize: '0.875rem' }}>{SCOPE_LABEL[sc]}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--metal-hi)', fontWeight: 700,
                             textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Always
              </span>
            </div>
          ))}
          {unlocks.map(sc => (
            <div key={sc} className="mi-card-p"
                 style={{ borderTop: '1px solid var(--line)',
                          display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <span className="mi-dot" data-s="on_the_way" />
              <span style={{ flex: 1, fontSize: '0.875rem' }}>{SCOPE_LABEL[sc]}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 700,
                             textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                With the fee
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
          You can always walk to your apartment — that never depends on paying.
          The fee is what opens the gate to drive in.
        </p>

        {/* ── Optional physical backup ──────────────────────────────────── */}
        <div className="mi-label" style={{ marginTop: '1.5rem' }}>
          How you&apos;ll open the gate
        </div>
        <AddOnPicker
          credentials={ctx.credentials}
          value={sel.addOn}
          onChange={k => setMember(me.id, { addOn: k })}
          id={me.id}
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
          : !vehicleOk
            ? (missing.length === 4
                ? 'Add your vehicle, or tick No vehicle'
                : `Add your ${missingPhrase(missing)}`)
            : 'Add a directory number'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
