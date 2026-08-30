'use client'

import { useState } from 'react'

import { money } from '@/components/chrome'
import { StepNav } from '../nav'
import { useMoveIn } from '../state'
import { computeFee } from '@/lib/fees'
import { buildReceipt } from '@/lib/receipt'
import { formatMoveInDate } from '@/lib/dates'
import type { ConfirmationItem, ItemState } from '@/lib/types'

/**
 * 06 · Confirmation
 *
 * Grouped by STATE — working now / on the way / scheduled — not by product.
 * A resident standing at the gate wants to know what happens if they walk up to
 * it right now; a product-grouped list makes them work that out themselves.
 *
 * The two money rails are shown in separate blocks and never interleaved.
 * Add to Wallet is the only button, because it is the only thing left that
 * changes the resident's day.
 */

const GROUPS: { state: ItemState; label: string }[] = [
  { state: 'working_now', label: 'Working now' },
  { state: 'on_the_way',  label: 'On the way' },
  { state: 'scheduled',   label: 'Scheduled' },
]

export default function Confirmation() {
  const { ctx, s } = useMoveIn()
  const siteSlug = ctx.property.slug

  const tier = ctx.parkingTiers.find(t => t.id === (s.parkingTierId || 'surface'))
  const [walletAdded, setWalletAdded] = useState(false)
  const fee = computeFee({
    fee: ctx.property.parkingFee,
    concession: ctx.resident.concession,
    termMonths: ctx.resident.leaseTermMonths,
  })

  // One document covering everything, with each line labelled by how it is
  // paid. One receipt, not one charge — the lease-bound fee still never
  // touches a card.
  const receipt = buildReceipt({
    ctx,
    credentialKinds: s.extraCredentials,
    cart: s.cart,
    serviceIds: s.services,
    requestedIds: s.requested,
  })

  const { firstName, lastName, unitNumber } = ctx.resident
  const directoryName =
    s.directoryFormat === 'full' ? `${firstName} ${lastName}`
    : s.directoryFormat === 'unit_only' ? `Unit ${unitNumber}`
    : `${firstName} ${lastName.charAt(0).toUpperCase()}.`

  const items: ConfirmationItem[] = [
    {
      id: 'phone',
      label: 'Phone key',
      detail: 'Gate and building door, from your phone',
      state: 'working_now',
      rail: 'included',
    },
    ...(ctx.parkingTiers.length === 0 && s.vehicle.plate ? [{
      id: 'parking',
      label: 'Parking pass',
      detail: `${s.vehicle.plate} · ${s.vehicle.state}`,
      state: 'working_now' as ItemState,
      rail: 'included' as const,
    }] : []),
    ...(tier ? [{
      id: 'parking-tier',
      label: tier.label,
      detail: s.vehicle.plate
        ? `${s.vehicle.plate} · ${s.vehicle.state}`
        : 'Registered to your unit',
      state: 'working_now' as ItemState,
      rail: (tier.included ? 'included' : 'included') as 'included',
    }] : []),
    ...s.extraCredentials.map(k => {
      const c = ctx.credentials.find(x => x.kind === k)!
      return {
        id: `cred-${k}`,
        label: c.label,
        detail: 'Ships in 3–5 days · activates on first tap',
        state: 'on_the_way' as ItemState,
        rail: 'card' as const,
      }
    }),
    ...Object.entries(s.cart).map(([id, q]) => {
      const p = ctx.store.find(x => x.id === id)!
      return {
        id: `store-${id}`,
        label: q > 1 ? `${p.name} × ${q}` : p.name,
        detail: 'Ships in 3–5 days',
        state: 'on_the_way' as ItemState,
        rail: 'card' as const,
      }
    }),
    {
      id: 'directory',
      label: s.directoryListed ? 'Listed at the callbox' : 'Not listed at the callbox',
      detail: s.directoryListed
        ? `Guests see “${directoryName}”`
        : 'Guests can’t look you up — let them in from your phone',
      state: 'working_now' as ItemState,
      rail: 'included' as const,
    },
    ...s.requested.map(id => {
      const o = ctx.services.find(x => x.id === id)!
      return {
        id: `req-${id}`,
        label: o.mode === 'quote' ? `${o.name} consultation` : `${o.name} activation`,
        detail: o.mode === 'quote'
          ? 'Someone will call to size it up — nothing charged yet'
          : `${o.provider} · live for your move-in date`,
        state: 'scheduled' as ItemState,
        rail: 'included' as const,
      }
    }),
    ...s.services.map(id => {
      const o = ctx.services.find(x => x.id === id)!
      return {
        id: `svc-${id}`,
        label: o.name,
        detail: `${o.provider} · starts on your move-in date`,
        state: 'scheduled' as ItemState,
        rail: 'card' as const,
      }
    }),
  ]

  const cardTotal =
    ctx.credentials.filter(c => s.extraCredentials.includes(c.kind))
      .reduce((n, c) => n + c.priceCents, 0)
    + Object.entries(s.cart).reduce((n, [id, q]) => {
        const p = ctx.store.find(x => x.id === id)
        return n + (p ? p.priceCents * q : 0)
      }, 0)

  const monthly = s.services.reduce((n, id) => {
    const o = ctx.services.find(x => x.id === id)
    return n + (o?.monthlyCents ?? 0)
  }, 0)

  return (
    <>
      <StepNav index={5} />
      <div className="mi-body">
        <h1 className="mi-h1">You&apos;re in, {ctx.resident.firstName}.</h1>
        <p className="mi-lede">
          Unit {ctx.resident.unitNumber}. Walk up to the gate and your phone will open it.
        </p>

        <button
          className="mi-btn"
          style={{ marginBottom: '0.5rem' }}
          onClick={() => setWalletAdded(true)}
          disabled={walletAdded}
        >
          {walletAdded ? '\u2713  Added to Apple Wallet' : 'Add your key to Apple Wallet'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
          {walletAdded
            ? 'Hold your phone near the reader — no need to open anything.'
            : 'Then it works from the lock screen, without opening an app.'}
        </p>

        {GROUPS.map(g => {
          const rows = items.filter(i => i.state === g.state)
          if (!rows.length) return null
          return (
            <div key={g.state}>
              <div className="mi-state-h">
                <span className="mi-dot" data-s={g.state} />
                {g.label}
              </div>
              <div className="mi-card">
                {rows.map((i, n) => (
                  <div key={i.id} className="mi-card-p"
                       style={{ borderTop: n ? '1px solid var(--line)' : 'none' }}>
                    <div className="mi-opt-title" style={{ fontSize: '0.875rem' }}>{i.label}</div>
                    <div className="mi-opt-blurb" style={{ fontSize: '0.75rem' }}>{i.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div className="mi-state-h">Your move-in summary</div>

        <div className="mi-card">
          {receipt.lines.map((l, i) => (
            <div key={l.id} className="mi-card-p"
                 style={{ borderTop: i ? '1px solid var(--line)' : 'none',
                          paddingTop: i ? '0.75rem' : undefined,
                          paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span className="mi-opt-title" style={{
                  fontSize: '0.875rem',
                  color: l.amountCents < 0 ? 'var(--ok)' : undefined,
                }}>
                  {l.label}
                </span>
                {/* Amounts only. A long note here collided with the label and
                    broke the row — explanations belong on the detail line. */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            gap: '0.75rem', marginTop: '0.125rem' }}>
                <span className="mi-opt-blurb" style={{ fontSize: '0.75rem' }}>
                  {l.note ?? l.detail}
                </span>
                {/* The rail, on every line. This is what makes one document
                    honest without pretending it is one payment. */}
                <span style={{
                  fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 650,
                }}>
                  {l.rail === 'lease' ? 'With your lease' : 'Your card'}
                </span>
              </div>
            </div>
          ))}

          <div className="mi-card-p" style={{
            borderTop: '1px solid var(--line-2)', background: 'var(--surface-sunk)',
            borderRadius: '0 0 var(--r-card) var(--r-card)',
          }}>
            {receipt.hasLease && (
              <div className="mi-fact" style={{ padding: '0.25rem 0', border: 'none' }}>
                <span className="mi-fact-k">Monthly, with your lease</span>
                <span className="mi-fact-v">
                  {receipt.leaseMonthlyCents === 0
                    ? 'Covered'
                    : `${money(receipt.leaseMonthlyCents)}/mo`}
                </span>
              </div>
            )}
            {receipt.cardTodayCents > 0 && (
              <div className="mi-fact" style={{ padding: '0.25rem 0', border: 'none' }}>
                <span className="mi-fact-k">On your card today</span>
                <span className="mi-fact-v">{money(receipt.cardTodayCents)}</span>
              </div>
            )}
            {receipt.cardMonthlyCents > 0 && (
              <div className="mi-fact" style={{ padding: '0.25rem 0', border: 'none' }}>
                <span className="mi-fact-k">Monthly, on your card</span>
                <span className="mi-fact-v">{money(receipt.cardMonthlyCents)}/mo</span>
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.625rem 0 0' }}>
              Two totals, not one — your lease and your card are billed
              separately. Nothing on your card can affect whether your key works,
              and no card is kept on file for the lease items.
            </p>
          </div>
        </div>

        <div className="mi-hatch" style={{ marginTop: '1.5rem' }}>
          Questions about your unit, your lease or your parking?{' '}
          <a href={`tel:${ctx.property.leasingPhone}`}>Call the {ctx.property.name} office</a>
          <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {ctx.property.leasingHours}
          </div>
        </div>
      </div>
    </>
  )
}
