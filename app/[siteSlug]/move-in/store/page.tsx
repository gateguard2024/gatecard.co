'use client'

import Link from 'next/link'
import { money } from '@/components/chrome'
import { StepNav } from '../nav'
import { formatMoveInDate } from '@/lib/dates'
import { useMoveIn } from '../state'

/**
 * 05 · Spares and the community store
 *
 * Two different things, deliberately separated now.
 *
 * Credential items — fobs, key tags — are ours. They are Brivo enrollments
 * shipped from Gate Guard stock, so they stay in our checkout and our cart.
 *
 * Merch is Shopify's, reached with a personal code rather than bought here.
 * That puts tax, shipping rates, delivery address, inventory and refunds back
 * where they were already solved, and makes charged-but-not-shipped impossible
 * — the money and the order become one transaction.
 *
 * It also moves merch out of the move-in minute and into the follow-up
 * sequence, which is where the revenue actually arrives.
 */
export default function Store() {
  const { ctx, s, set } = useMoveIn()
  const siteSlug = ctx.property.slug

  const qty = (id: string) => s.cart[id] ?? 0
  const bump = (id: string, d: number) => {
    const next = Math.max(0, qty(id) + d)
    const cart = { ...s.cart }
    if (next === 0) delete cart[id]; else cart[id] = next
    set('cart', cart)
  }

  // Only our own items are purchasable here.
  const items = ctx.store.filter(p => p.fulfilment === 'credential')
  const total = items.reduce((n, p) => n + p.priceCents * qty(p.id), 0)
  const count = Object.values(s.cart).reduce((n, q) => n + q, 0)
  const storeCode = ctx.resident.storeCode

  return (
    <>
      <StepNav index={4} />
      <div className="mi-body">
        <h1 className="mi-h1">Spares</h1>
        <p className="mi-lede">
          Extra fobs and key tags for your household. Same as before — they
          arrive inactive and switch on at the gate.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          {items.map(p => {
            const q = qty(p.id)
            return (
              <div key={p.id} className="mi-card"
                   style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column',
                            opacity: p.inStock ? 1 : 0.5 }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt=""
                       style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                                borderRadius: '8px', marginBottom: '0.5rem',
                                background: 'var(--surface-sunk)' }} />
                ) : (
                  <div style={{ fontSize: '1.75rem', lineHeight: 1, marginBottom: '0.5rem' }} aria-hidden>
                    {p.imageEmoji}
                  </div>
                )}
                <div className="mi-opt-title" style={{ fontSize: '0.875rem' }}>{p.name}</div>
                <div className="mi-opt-blurb" style={{ fontSize: '0.75rem', flex: 1 }}>{p.blurb}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginTop: '0.75rem', gap: '0.5rem' }}>
                  <span className="mi-price">{money(p.priceCents)}</span>

                  {!p.inStock ? (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>Sold out</span>
                  ) : q === 0 ? (
                    <button onClick={() => bump(p.id, 1)} className="mi-btn"
                            style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.8125rem' }}>
                      Add
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => bump(p.id, -1)} aria-label={`One fewer ${p.name}`}
                              className="mi-btn mi-btn-2"
                              style={{ width: 30, minHeight: 30, padding: 0 }}>−</button>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: 12, textAlign: 'center' }}>{q}</span>
                      <button onClick={() => bump(p.id, 1)} aria-label={`One more ${p.name}`}
                              className="mi-btn"
                              style={{ width: 30, minHeight: 30, padding: 0 }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/*
          The community store lives in Shopify. The code is a welcome gift and,
          because it is single-use and personal, the thing that tells us which
          resident bought what — which is how store sales still reach the
          commission ledger without us touching the money.
        */}
        {storeCode && (
          <div className="mi-card mi-card-p" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="mi-opt-title" style={{ flex: 1 }}>
                {ctx.property.name} community store
              </span>
              <span className="mi-badge">{storeCode.percentOff}% off</span>
            </div>
            <div className="mi-opt-blurb">
              Doormats, tumblers, plants and the rest — delivered wherever you
              want them, which may not be the unit before you move in.
            </div>

            <div style={{
              marginTop: '0.875rem', padding: '0.75rem',
              background: 'var(--surface-sunk)', borderRadius: 'var(--r-btn)',
              border: '1px dashed var(--line-2)', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '0.08em',
              }}>
                {storeCode.code}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                Yours alone · one use · expires {formatMoveInDate(storeCode.expiresOn)}
              </div>
            </div>

            <a href={storeCode.storeUrl} target="_blank" rel="noopener noreferrer"
               className="mi-btn mi-btn-2" style={{ marginTop: '0.875rem' }}>
              Open the store
            </a>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
              We&apos;ll send this code to you as well, so you don&apos;t need it now.
            </p>
          </div>
        )}
      </div>

      <div className="mi-foot">
        <Link href={`/${siteSlug}/move-in/confirmation`} className="mi-btn">
          {count > 0 ? `Check out · ${money(total)}` : 'Continue'}
        </Link>
        {count > 0 && (
          <Link href={`/${siteSlug}/move-in/confirmation`} className="mi-skip">
            Skip the store
          </Link>
        )}
      </div>
    </>
  )
}
