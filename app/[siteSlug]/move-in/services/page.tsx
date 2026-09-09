'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark } from '../nav'
import { useMoveIn } from '../state'
import {
  TvArt, SecurityArt, WalletArt, WifiArt, GiftArt,
} from '@/components/art'
import type { ServiceOffer } from '@/lib/types'

/**
 * 04 · Home services
 *
 * Access is already done. The screen says so first, because the whole point of
 * putting the ordering last is that nothing optional can hold up a working key.
 *
 * Every card is offer-engine output (D7), in one of four modes:
 *   included    — bulk ROE at this property. The card is an activation helper,
 *                 not a purchase. No price, no total.
 *   sellable    — orderable; commission tracked
 *   quote       — configurator, deposit + monitoring
 *   unavailable — not rendered at all
 *
 * Nothing about any one property is coded here. Change the table, change the
 * screen.
 */

const ART: Record<ServiceOffer['category'], (p: { size: number }) => React.JSX.Element> = {
  internet: WifiArt,
  tv: TvArt,
  security: SecurityArt,
  insurance: WalletArt,
  other: GiftArt,
}

export default function Services() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const offers = ctx.services.filter(o => o.mode !== 'unavailable')

  // Sellable offers are switched on; included and quote offers are *requested*.
  // Neither of the latter is a purchase, so they stay out of `services` and
  // never reach a total.
  const toggle = (o: ServiceOffer) => {
    const key = o.mode === 'sellable' ? 'services' : 'requested'
    const list = s[key]
    set(key, list.includes(o.id) ? list.filter(x => x !== o.id) : [...list, o.id])
  }

  const isOn = (o: ServiceOffer) =>
    (o.mode === 'sellable' ? s.services : s.requested).includes(o.id)

  const price = (o: ServiceOffer) =>
    o.mode === 'included' ? 'Included with your lease'
    : o.mode === 'quote' ? 'Free consultation'
    : o.monthlyCents !== null ? `From ${money(o.monthlyCents)}/mo`
    : '—'

  const cta = (o: ServiceOffer, on: boolean) =>
    on ? 'Selected'
    : o.mode === 'quote' ? 'Request'
    : o.mode === 'included' ? 'Activate'
    : 'Select'

  const monthly = offers
    .filter(o => o.mode === 'sellable' && s.services.includes(o.id))
    .reduce((n, o) => n + (o.monthlyCents ?? 0), 0)

  return (
    <>
      <StepNav index={3} />
      <div className="mi-body">
        <h1 className="mi-h1">Optional services</h1>
        <p className="mi-lede">
          None of this is required. Pick only what you want.
        </p>

        <div className="mi-free">
          <span aria-hidden>✓</span>
          Your access is already set — nothing here can hold it up.
        </div>

        {offers.map(o => {
          const on = isOn(o)
          const Art = ART[o.category]
          return (
            <div key={o.id} className="mi-prod" data-on={on ? 'true' : 'false'}>
              <div className="mi-art-inline"><Art size={64} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mi-prod-title">{o.name}</div>
                    <p className="mi-opt-blurb" style={{ margin: '0.1875rem 0 0' }}>
                      {o.blurb}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="mi-switch"
                    checked={on}
                    onChange={() => toggle(o)}
                    aria-label={`${on ? 'Remove' : 'Add'} ${o.name}`}
                  />
                </div>

                {o.leaseRequired && (
                  <div style={{ marginTop: '0.375rem' }}>
                    <span className="mi-badge" data-tone="req">Lease requires it</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', gap: '0.75rem',
                              marginTop: '0.5rem' }}>
                  <span className="mi-prod-price">{price(o)}</span>
                  <button type="button"
                          className={on ? 'mi-pill mi-pill-on' : 'mi-pill'}
                          onClick={() => toggle(o)}>
                    {cta(o, on)}
                  </button>
                </div>

                {on && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)',
                              margin: '0.5rem 0 0' }}>
                    {o.mode === 'quote'
                      ? 'Someone will call to size it up. Nothing is charged until you approve a quote.'
                      : o.mode === 'included'
                      ? 'We’ll have it live for your move-in date.'
                      : 'Starts with your move-in date. Cancel any time from your resident app.'}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.25rem' }}>
          Anything you skip stays available in your resident app.
        </p>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/review`}
        label={monthly > 0
          ? `Next: Review and payment · ${money(monthly)}/mo added`
          : 'Next: Review and payment'}
      />
      <StripeMark />
    </>
  )
}
