'use client'

import { money } from '@/components/chrome'
import { StepNav } from '../nav'
import { useMoveIn, addOnPrice } from '../state'
import { buildReceipt } from '@/lib/receipt'
import { computeFee } from '@/lib/fees'
import { formatMoveInDate } from '@/lib/dates'
import { PhoneKeyArt, GiftArt } from '@/components/art'
import { SCOPE_LABEL, type ItemState } from '@/lib/types'

/**
 * 06 · Confirmation
 *
 * Grouped by STATE — working now / on the way / scheduled — not by product. A
 * resident standing at the gate wants to know what happens if they walk up to
 * it right now; a product-grouped list makes them work that out themselves.
 *
 * ── About the phone key ──────────────────────────────────────────────────────
 * There is no "Add to Apple Wallet" button here, and there cannot be one yet.
 * Brivo exposes no wallet-provisioning API to integrators: the documented
 * journey is an emailed Mobile Pass invite, the Brivo Mobile Pass app, and the
 * resident adding the pass to their wallet from inside that app. Promising a
 * one-tap wallet add on this screen would be a promise the platform can't keep,
 * so the screen tells them exactly what will land in their inbox instead. See
 * docs/BRIVO-API.md.
 */

const GROUPS: { state: ItemState; label: string }[] = [
  { state: 'working_now', label: 'Working now' },
  { state: 'on_the_way',  label: 'On the way' },
  { state: 'scheduled',   label: 'Scheduled' },
]

const SUPPORT_TEL = '+18444694283'
const SUPPORT_LABEL = '844-4MY-GATE'

export default function Confirmation() {
  const { ctx, s } = useMoveIn()
  const { property, resident } = ctx

  const receipt = buildReceipt({
    ctx,
    members: s.members,
    serviceIds: s.services,
    requestedIds: s.requested,
    promo: s.promo,
  })

  const fee = computeFee({ fee: property.parkingFee, promo: s.promo })
  const holders = resident.household.filter(m => s.members[m.id]?.pass)

  const directoryName =
    property.directory.format === 'full'
      ? `${resident.firstName} ${resident.lastName}`
      : property.directory.format === 'unit_only'
        ? `Unit ${resident.unitNumber}`
        : `${resident.firstName} ${resident.lastName.charAt(0).toUpperCase()}.`

  const ADDON: Record<string, string> = { fob: 'Key fob', keytag: 'Key tag' }

  // Everything is live now — the fee is paid, so both scope groups collapse
  // into one list. Naming them is the receipt for what the fee bought.
  const scopes = [...property.access.alwaysGranted, ...property.access.feeUnlocks]
  const opens = scopes.map(sc => SCOPE_LABEL[sc]).join(' · ')

  const items = [
    ...holders.map(m => ({
      id: `pass-${m.id}`,
      label: `${m.firstName}’s phone key`,
      detail: m.alreadyActive
        ? 'Already on the roster — unchanged'
        : `${opens}, from ${m.role === 'me' ? 'your' : 'their'} phone`,
      state: 'working_now' as ItemState,
    })),
    ...holders.flatMap(m => {
      const sel = s.members[m.id]
      if (sel.noVehicle || !sel.vehicle?.plate.trim()) return []
      const v = sel.vehicle
      return [{
        id: `veh-${m.id}`,
        label: `${m.firstName}’s vehicle`,
        detail: [`${v.plate} · ${v.state}`, [v.make, v.model].filter(Boolean).join(' ')]
          .filter(Boolean).join(' · '),
        state: 'working_now' as ItemState,
      }]
    }),
    {
      id: 'directory',
      label: s.directoryListed ? 'Listed at the callbox' : 'Not listed at the callbox',
      detail: s.directoryListed
        ? `Guests see “${directoryName}” and it rings ${s.directoryPhone || s.mobile}`
        : 'Guests can’t look you up — let them in from your phone',
      state: 'working_now' as ItemState,
    },
    ...holders.flatMap(m => {
      const sel = s.members[m.id]
      if (sel.addOn === 'none') return []
      return [{
        id: `addon-${m.id}`,
        label: `${ADDON[sel.addOn]} — ${m.firstName}`,
        detail: 'Ships in 3–5 days · activates on its first tap at the gate',
        state: 'on_the_way' as ItemState,
      }]
    }),
    ...s.requested.map(id => {
      const o = ctx.services.find(x => x.id === id)!
      return {
        id: `req-${id}`,
        label: o.mode === 'quote' ? `${o.name} consultation` : `${o.name} activation`,
        detail: o.mode === 'quote'
          ? 'Someone will call to size it up — nothing charged yet'
          : `${o.provider} · live for your move-in date`,
        state: 'scheduled' as ItemState,
      }
    }),
    ...s.services.map(id => {
      const o = ctx.services.find(x => x.id === id)!
      return {
        id: `svc-${id}`,
        label: o.name,
        detail: `${o.provider} · starts ${formatMoveInDate(resident.moveInDate)}`,
        state: 'scheduled' as ItemState,
      }
    }),
  ]

  const shipping = holders.filter(m => s.members[m.id].addOn !== 'none')

  return (
    <>
      <StepNav index={5} />
      <div className="mi-body">
        <h1 className="mi-h1">You&apos;re all set, {resident.firstName}.</h1>
        <p className="mi-lede">
          Unit {resident.unitNumber}. Walk up to the gate and your phone will
          open it.
        </p>

        {receipt.dueTodayCents > 0 && (
          <div className="mi-free">
            <span aria-hidden>✓</span>
            Payment of {money(receipt.dueTodayCents)} received. A receipt is on
            its way to {resident.email}.
          </div>
        )}

        {/* ── The phone key. Honest about how it actually arrives. ──────── */}
        <div className="mi-prod" data-on="true">
          <div className="mi-art-inline"><PhoneKeyArt size={64} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mi-prod-title">Set up your phone key</div>
            <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
              Check <b>{resident.email}</b> for your mobile pass invitation. Open
              it on your phone, install the app it points you to, and your key is
              live — including on your lock screen.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
              It usually lands within a few minutes. If it hasn&apos;t arrived in
              an hour, call us and we&apos;ll resend it.
            </p>
          </div>
        </div>

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

        {shipping.length > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.75rem' }}>
            Physical keys are made up and posted to Unit {resident.unitNumber}.
            They arrive blank and inert — the first tap at the gate is what
            activates them, so one lost in the post is not a key to the community.
          </p>
        )}

        {/* ── What it cost ──────────────────────────────────────────────── */}
        <div className="mi-state-h">Your summary</div>
        <div className="mi-card">
          {receipt.lines.map((l, i) => (
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
                  color: l.amountCents < 0 ? 'var(--ok)' : undefined,
                }}>
                  {`${l.amountCents < 0 ? '−' : ''}${money(Math.abs(l.amountCents))}${
                    l.cadence === 'monthly' ? '/mo' : ''}`}
                </span>
              </div>
              {l.detail && (
                <div className="mi-opt-blurb" style={{ fontSize: '0.75rem' }}>{l.detail}</div>
              )}
            </div>
          ))}
          <div className="mi-card-p" style={{
            borderTop: '1px solid var(--line-2)', background: 'var(--surface-sunk)',
            borderRadius: '0 0 var(--r-card) var(--r-card)',
          }}>
            <div className="mi-fact" style={{ padding: '0.25rem 0', border: 'none' }}>
              <span className="mi-fact-k">Paid today</span>
              <span className="mi-fact-v">{money(receipt.dueTodayCents)}</span>
            </div>
            {receipt.monthlyCents > 0 && (
              <div className="mi-fact" style={{ padding: '0.25rem 0', border: 'none' }}>
                <span className="mi-fact-k">Monthly from move-in</span>
                <span className="mi-fact-v">{money(receipt.monthlyCents)}/mo</span>
              </div>
            )}
            {fee && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.625rem 0 0' }}>
                The {property.parkingFee!.label.toLowerCase()} was charged once for
                your unit, not per person, and is paid in full through{' '}
                {formatMoveInDate(resident.leaseEndDate ?? resident.moveInDate)}.
              </p>
            )}
          </div>
        </div>

        {/* ── Store ─────────────────────────────────────────────────────── */}
        {resident.storeCode && (
          <div className="mi-prod" style={{ marginTop: '1.25rem' }}>
            <div className="mi-art-inline"><GiftArt size={64} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mi-prod-title">{property.name} community store</div>
              <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
                {resident.storeCode.percentOff}% off as a welcome — doormats,
                plants, supplies and spare tags.
              </p>
              <div className="mi-code">
                {resident.storeCode.code}
                <span>{resident.storeCode.percentOff}% off</span>
              </div>
              <a href={resident.storeCode.storeUrl} target="_blank" rel="noreferrer"
                 className="mi-btn" style={{ marginTop: '0.5rem' }}>
                Open community store
              </a>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
                Yours alone, one use, expires{' '}
                {formatMoveInDate(resident.storeCode.expiresOn)}. It&apos;s in your
                email too.
              </p>
            </div>
          </div>
        )}

        {/* ── Support. Ours for access, theirs for the lease. ───────────── */}
        <div className="mi-state-h">If something isn&apos;t working</div>
        <div className="mi-card mi-card-p">
          <div className="mi-opt-title">Gate, keys and access</div>
          <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0.625rem' }}>
            That&apos;s us, any time. Your leasing office isn&apos;t the help desk
            for this.
          </p>
          <a href={`tel:${SUPPORT_TEL}`} className="mi-btn">Call {SUPPORT_LABEL}</a>
        </div>

        <div className="mi-hatch" style={{ marginTop: '0.875rem' }}>
          Questions about your unit, your lease or your parking space?{' '}
          <a href={`tel:${property.leasingPhone}`}>Call the {property.name} office</a>
          <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {property.leasingHours}
          </div>
        </div>
      </div>
    </>
  )
}
