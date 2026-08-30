'use client'

import Link from 'next/link'
import { money } from '@/components/chrome'
import { StepNav } from '../nav'
import { useMoveIn } from '../state'

/**
 * 05 · Store
 *
 * The only real cart in the portal.
 *
 * Credential items (fobs, key tags) and dropship merch sit in one grid on
 * purpose — the resident cannot tell them apart and shouldn't. The order
 * handler must: 'credential' routes to Brivo enrollment, 'merch' routes to the
 * dropship supplier (D5). That distinction is in the data, never in the UI.
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

  const total = ctx.store.reduce((n, p) => n + p.priceCents * qty(p.id), 0)
  const count = Object.values(s.cart).reduce((n, q) => n + q, 0)

  return (
    <>
      <StepNav index={4} />
      <div className="mi-body">
        <h1 className="mi-h1">Community store</h1>
        <p className="mi-lede">
          Spares, and a few things for the new place. Shipped to unit {ctx.resident.unitNumber}.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          {ctx.store.map(p => {
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

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.25rem' }}>
          Fobs and key tags arrive inactive and switch themselves on the first time you
          tap at the gate.
        </p>
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
