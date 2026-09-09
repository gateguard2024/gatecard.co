'use client'

import { useState } from 'react'
import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark } from '../nav'
import { useMoveIn, addOnPrice } from '../state'
import { buildReceipt, type ReceiptLine } from '@/lib/receipt'
import { computeFee, redeemPromo } from '@/lib/fees'
import { formatMoveInDate } from '@/lib/dates'
import { Avatar } from '@/components/move-in-parts'
import { SCOPE_LABEL } from '@/lib/types'

/**
 * 05 · Review and payment
 *
 * One summary, one card, one charge. The fee, the add-ons and any monthly
 * service the resident added, and nothing claiming to have been posted to a
 * rent ledger we have no access to.
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

  const [checking, setChecking] = useState(false)

  const receipt = buildReceipt({
    ctx,
    members: s.members,
    serviceIds: s.services,
    requestedIds: s.requested,
    promo: s.promo,
  })

  const fee = computeFee({ fee: property.parkingFee, promo: s.promo })
  const holders = resident.household.filter(m => s.members[m.id]?.pass)

  const once = receipt.lines.filter(l => l.cadence === 'once' && l.amountCents !== 0)
  const monthly = receipt.lines.filter(l => l.cadence === 'monthly' && l.amountCents !== 0)
  const total = receipt.dueTodayCents

  // Validation is local while this runs on mock data. In production the code
  // goes to the server and only the verdict comes back — the client must never
  // hold the property's unredeemed codes.
  const apply = () => {
    setChecking(true)
    const result = redeemPromo({
      input: s.promoInput,
      codes: ctx.promoCodes,
      fee: property.parkingFee,
      today: new Date().toISOString(),
    })
    set('promo', result.code ? result : null)
    setChecking(false)
  }

  const clearPromo = () => { set('promo', null); set('promoInput', '') }

  const ADDON: Record<string, string> = { fob: 'Key fob', keytag: 'Key tag' }

  // "Maya and Andre", "Maya, Andre and Asha" — an Oxford-free list, because it
  // is read aloud in the head and a trailing comma reads as a missing name.
  const unlockNames = property.access.feeUnlocks
    .map(sc => SCOPE_LABEL[sc].toLowerCase())
    .join(', ')

  const first = holders.map(m => m.firstName)
  const names = first.length <= 1
    ? first[0] ?? 'your household'
    : `${first.slice(0, -1).join(', ')} and ${first[first.length - 1]}`

  return (
    <>
      <StepNav index={4} />
      <div className="mi-body">
        <h1 className="mi-h1">Review and payment</h1>
        <p className="mi-lede">
          Unit {resident.unitNumber} · {formatMoveInDate(resident.moveInDate)}
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          This is the step that switches your keys on. Payment is processed
          securely by Stripe.
        </div>

        {/* ── Who is getting what ───────────────────────────────────────── */}
        <div className="mi-state-h">Your household</div>
        <div className="mi-card">
          {holders.map((m, i) => {
            const sel = s.members[m.id]
            const price = addOnPrice(ctx, sel.addOn)
            return (
              <div key={m.id} className="mi-card-p"
                   style={{ borderTop: i ? '1px solid var(--line)' : 'none',
                            display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Avatar first={m.firstName} last={m.lastName} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mi-opt-title" style={{ fontSize: '0.9375rem' }}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="mi-opt-blurb" style={{ fontSize: '0.75rem' }}>
                    Phone key
                    {sel.addOn !== 'none' && ` · ${ADDON[sel.addOn]}`}
                    {sel.noVehicle
                      ? ' · No vehicle'
                      : sel.vehicle?.plate
                        ? ` · ${sel.vehicle.plate} ${sel.vehicle.state}`
                        : ''}
                  </div>
                </div>
                <span className="mi-fact-v" style={{ whiteSpace: 'nowrap' }}>
                  {price > 0 ? money(price) : 'Included'}
                </span>
              </div>
            )
          })}
        </div>

        {/* ── Concession code ───────────────────────────────────────────── */}
        <div className="mi-state-h">Concession code</div>
        {ctx.promoCodes.length === 0 ? (
          <div className="mi-hatch">
            {property.name} doesn&apos;t run a concession programme, so there is
            no code to enter here.
          </div>
        ) : s.promo?.ok ? (
          <div className="mi-card mi-card-p">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mi-opt-title" style={{ color: 'var(--ok)' }}>
                  ✓ Code applied — {s.promo.code}
                </div>
                <div className="mi-opt-blurb" style={{ fontSize: '0.75rem' }}>
                  {property.name} is covering {money(s.promo.coversCents)} of your fee.
                </div>
              </div>
              <button type="button" className="mi-chip" onClick={clearPromo}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mi-card mi-card-p">
            <label className="mi-label" htmlFor="promo">
              Have a code from your leasing office?
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="promo"
                className="mi-input"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="EP-XXXX-XXXX"
                value={s.promoInput}
                onChange={e => set('promoInput', e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
                style={{ flex: 1 }}
              />
              <button type="button" className="mi-pill mi-pill-on"
                      onClick={apply} disabled={checking || !s.promoInput.trim()}>
                Apply
              </button>
            </div>
            {/* Every refusal names its reason. "Invalid code" on a screen the
                resident can't get past is how a move-in becomes a phone call. */}
            {s.promo && !s.promo.ok && s.promo.reason && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--warn)', margin: '0.625rem 0 0' }}>
                {s.promo.reason}
              </p>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.625rem 0 0' }}>
              Some properties cover the fee for you. If you weren&apos;t given a
              card, you don&apos;t have one — nothing is missing.
            </p>
          </div>
        )}

        {/* ── Money ─────────────────────────────────────────────────────── */}
        {once.length > 0 ? (
          <>
            <div className="mi-state-h">Due today · one-time</div>
            <Rows lines={once} />
            {fee && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                The {property.parkingFee!.label.toLowerCase()} is charged once for
                Unit {resident.unitNumber} — not per person — and covers a full
                twelve months. It is paid in full today, not financed.
              </p>
            )}
          </>
        ) : (
          <div className="mi-free" style={{ marginTop: '1rem' }}>
            <span aria-hidden>✓</span>
            Nothing to pay today.
          </div>
        )}

        {monthly.length > 0 && (
          <>
            <div className="mi-state-h">Monthly · charged to this card</div>
            <Rows lines={monthly} />
          </>
        )}

        {receipt.pending.length > 0 && (
          <>
            <div className="mi-state-h">Requested · nothing charged</div>
            <Rows lines={receipt.pending} />
          </>
        )}

        {/* ── Payment ───────────────────────────────────────────────────── */}
        <div className="mi-state-h">Payment</div>
        <div className="mi-card">
          <div className="mi-pay-total">
            <span>Amount set to pay now</span>
            <span>{money(total)}</span>
          </div>

          {total > 0 ? (
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
                  <label className="mi-label" htmlFor="exp">Expires</label>
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

              {/* The one thing a resident must understand before they leave
                  this screen: stopping here means no key. */}
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0.75rem 0 0' }}>
                This payment opens {unlockNames} for {names}. If you stop here,
                nothing is charged — and you can still walk to your apartment,
                that never depends on paying.
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                Demo mode — the card is Stripe&apos;s test number and this form
                takes no input. Nothing is charged.
              </p>
            </div>
          ) : (
            <div className="mi-card-p">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: 0 }}>
                Your fee is covered and you added nothing else, so there is no
                card to enter. You still have to finish — that is what opens the
                gate for you.
              </p>
            </div>
          )}
        </div>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/confirmation`}
        label={total > 0
          ? `Pay ${money(total)} and complete setup`
          : 'Complete setup'}
      />
      <StripeMark />
    </>
  )
}
