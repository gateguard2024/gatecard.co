'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark } from '../nav'
import { useMoveIn } from '../state'
import { buildReceipt, type ReceiptLine } from '@/lib/receipt'
import { computeFee } from '@/lib/fees'
import { formatMoveInDate } from '@/lib/dates'

/**
 * 05 · Review and pay
 *
 * One document, two rails.
 *
 * The lease-bound parking and amenity fee is stated here but never charged —
 * we have no rent-ledger access, so this screen must not claim the fee has been
 * posted anywhere. It says where the fee lives (the lease) and stops. The card
 * pays for physical keys and any monthly service the resident actually added.
 *
 * The card form is a demo shell: read-only, pre-filled with Stripe's test card,
 * and it submits nothing. When Stripe Elements lands it replaces this block and
 * nothing above it changes.
 */

const CARD_DEMO = {
  number: '4242 4242 4242 4242',
  expiry: '12 / 28',
  cvc: '123',
  zip: '30301',
}

function Rows({ lines }: { lines: ReceiptLine[] }) {
  return (
    <div className="mi-card">
      {lines.map((l, i) => (
        <div key={l.id} className="mi-card-p"
             style={{ borderTop: i ? '1px solid var(--line)' : 'none',
                      paddingTop: '0.8125rem', paddingBottom: '0.8125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span className="mi-opt-title" style={{
              fontSize: '0.875rem',
              color: l.amountCents < 0 ? 'var(--ok)' : undefined,
            }}>
              {l.label}
            </span>
            <span className="mi-fact-v" style={{
              whiteSpace: 'nowrap',
              color: l.amountCents < 0 ? 'var(--ok)'
                   : l.amountCents === 0 ? 'var(--text-3)' : undefined,
            }}>
              {l.amountCents === 0
                ? 'No charge'
                : `${l.amountCents < 0 ? '−' : ''}${money(Math.abs(l.amountCents))}${
                    l.cadence === 'monthly' ? '/mo' : ''}`}
            </span>
          </div>
          {(l.detail || l.note) && (
            <div className="mi-opt-blurb" style={{ fontSize: '0.75rem', marginTop: '0.125rem' }}>
              {l.note ?? l.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Review() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

  const receipt = buildReceipt({
    ctx,
    keys: s.keys,
    serviceIds: s.services,
    requestedIds: s.requested,
  })

  const fee = computeFee({
    fee: property.parkingFee,
    concession: resident.concession,
    termMonths: resident.leaseTermMonths,
  })

  const dueToday = receipt.lines.filter(l => l.cadence === 'once' && l.amountCents !== 0)
  const cardMonthly = receipt.lines.filter(l => l.cadence === 'monthly' && l.amountCents !== 0)
  const pending = receipt.lines.filter(l => l.amountCents === 0 && l.note)

  const total = receipt.cardTodayCents

  // Directory listing lives here rather than on screen 1: it is a privacy
  // choice, and a resident should confirm it at the point of committing, not
  // three screens earlier where it competes with the phone-number field.
  const dir = property.directory
  const nameFor = (f: typeof s.directoryFormat) =>
    f === 'full' ? `${resident.firstName} ${resident.lastName}`
    : f === 'unit_only' ? `Unit ${resident.unitNumber}`
    : `${resident.firstName} ${resident.lastName.charAt(0).toUpperCase()}.`

  return (
    <>
      <StepNav index={4} />
      <div className="mi-body">
        <h1 className="mi-h1">Review and pay</h1>
        <p className="mi-lede">
          Unit {resident.unitNumber} · Move-in {formatMoveInDate(resident.moveInDate)}
        </p>

        {dueToday.length > 0 ? (
          <>
            <div className="mi-state-h">Due today · one-time payment</div>
            <Rows lines={dueToday} />
            {fee && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                The {property.parkingFee!.label.toLowerCase()} is charged once for
                Unit {resident.unitNumber} — not per person. Adding a pass for
                someone else on the lease costs nothing.
              </p>
            )}
          </>
        ) : (
          <div className="mi-free">
            <span aria-hidden>✓</span>
            Nothing to pay today. Your phone key is included.
          </div>
        )}

        {cardMonthly.length > 0 && (
          <>
            <div className="mi-state-h">Monthly · charged to this card</div>
            <Rows lines={cardMonthly} />
          </>
        )}

        {pending.length > 0 && (
          <>
            <div className="mi-state-h">Requested · nothing charged</div>
            <Rows lines={pending} />
          </>
        )}

        {/* ── Callbox directory ─────────────────────────────────────────── */}
        {dir.mode !== 'hidden' && (
          <>
            <div className="mi-state-h">Callbox directory</div>
            <div className="mi-card mi-card-p">
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                            justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mi-opt-title">
                    {dir.mode === 'required' ? 'Listed at the gate' : 'List me at the gate'}
                  </div>
                  <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
                    {dir.note ?? `Guests and couriers can find you on the callbox and
                                  ring your phone. It never affects your own access.`}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mi-switch"
                  checked={dir.mode === 'required' ? true : s.directoryListed}
                  disabled={dir.mode === 'required'}
                  onChange={e => set('directoryListed', e.target.checked)}
                  aria-label="List me in the callbox directory"
                />
              </div>

              {(s.directoryListed || dir.mode === 'required') && dir.formats.length > 1 && (
                <div style={{ marginTop: '0.875rem' }}>
                  <div className="mi-label">Shown to guests as</div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {dir.formats.map(f => (
                      <button
                        key={f}
                        type="button"
                        className={s.directoryFormat === f ? 'mi-chip mi-chip-on' : 'mi-chip'}
                        onClick={() => set('directoryFormat', f)}
                      >
                        {nameFor(f)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {dir.mode === 'required' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.625rem 0 0' }}>
                  {property.name} requires every unit to be listed so deliveries
                  can reach you.
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Payment ───────────────────────────────────────────────────── */}
        <div className="mi-state-h">Payment</div>
        <div className="mi-card">
          <div className="mi-pay-total">
            <span>Amount set to pay now</span>
            <span>{money(total)}</span>
          </div>

          <div className="mi-card-p">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="mi-label" htmlFor="cc" style={{ margin: 0 }}>Card number</label>
              <div className="mi-brands" aria-hidden>
                <span className="mi-brand">VISA</span>
                <span className="mi-brand">MC</span>
                <span className="mi-brand">AMEX</span>
              </div>
            </div>
            <input id="cc" className="mi-input" readOnly value={CARD_DEMO.number}
                   inputMode="numeric" autoComplete="off" />

            <div className="mi-card-grid">
              <div>
                <label className="mi-label" htmlFor="exp">Expiry</label>
                <input id="exp" className="mi-input" readOnly value={CARD_DEMO.expiry} />
              </div>
              <div>
                <label className="mi-label" htmlFor="cvc">CVC</label>
                <input id="cvc" className="mi-input" readOnly value={CARD_DEMO.cvc} />
              </div>
              <div>
                <label className="mi-label" htmlFor="zip">ZIP</label>
                <input id="zip" className="mi-input" readOnly value={CARD_DEMO.zip} />
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.75rem 0 0' }}>
              Demo mode — the card is Stripe&apos;s test number and this form takes
              no input. Nothing is charged.
            </p>
          </div>
        </div>

        {resident.storeCode && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1rem' }}>
            Your {resident.storeCode.percentOff}% community-store code arrives on the
            next screen and by email.
          </p>
        )}
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/confirmation`}
        label={total > 0 ? `Pay ${money(total)} and complete setup` : 'Complete setup'}
      />
      <StripeMark />
    </>
  )
}
