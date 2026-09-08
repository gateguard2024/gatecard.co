'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useMoveIn } from './state'

/**
 * Step navigation across five steps.
 *
 * Browser back works, but there is no visible control — this is used on a
 * phone, outdoors, sometimes installed to the home screen where there is no
 * browser chrome at all. So the rail is the navigation.
 *
 * Forward is capped at the furthest step reached: later screens read answers
 * from earlier ones, and a resident landing on Review with no passes and no
 * plate sees a summary of nothing and concludes the portal is broken.
 */

const SEGMENTS = ['', 'vehicles', 'keys', 'services', 'review']

const LABELS = [
  'Step 1 of 5 · Who you are',
  'Step 2 of 5 · Add vehicles',
  'Step 3 of 5 · Choose physical keys',
  'Step 4 of 5 · Choose home upgrades',
  'Step 5 of 5 · Review and pay',
  'Setup complete',
]

const SHORT = ['Who you are', 'Vehicles', 'Keys', 'Services', 'Review']

export function StepNav({ index }: { index: number }) {
  const { ctx, s, set } = useMoveIn()
  const base = `/${ctx.property.slug}/move-in`

  useEffect(() => {
    if (index > s.furthest) set('furthest', index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const href = (i: number) => (i === 0 ? base : `${base}/${SEGMENTS[i]}`)
  const reachable = (i: number) => i <= Math.max(s.furthest, index)

  return (
    <>
      <nav className="mi-rail" aria-label="Move-in steps">
        {SEGMENTS.map((_, i) => {
          const now = i === index
          const canGo = reachable(i) && !now
          const seg = (
            <span className="mi-rail-seg"
                  data-on={i < index ? 'true' : 'false'}
                  data-now={now ? 'true' : 'false'} />
          )
          return canGo ? (
            <Link key={i} href={href(i)} className="mi-rail-hit"
                  aria-label={`Go to ${SHORT[i]}`}>{seg}</Link>
          ) : (
            <span key={i} className="mi-rail-hit"
                  aria-current={now ? 'step' : undefined}>{seg}</span>
          )
        })}
      </nav>

      <div className="mi-rail-row">
        {index > 0 && index < SEGMENTS.length ? (
          <Link href={href(index - 1)} className="mi-back" aria-label="Go back a step">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {SHORT[index - 1]}
          </Link>
        ) : <span />}
        <span className="mi-rail-label">{LABELS[index]}</span>
      </div>
    </>
  )
}

/** Stripe is doing the work; saying so is a trust cue on a payment flow. */
export function StripeMark() {
  return (
    <div className="mi-stripe">
      Powered by <b>stripe</b>
    </div>
  )
}
