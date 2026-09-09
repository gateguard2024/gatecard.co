'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useMoveIn } from './state'

/**
 * Step navigation across six steps.
 *
 * Browser back works, but there is no visible control — this runs on a phone,
 * outdoors, sometimes installed to the home screen where there is no browser
 * chrome at all. So the rail is the navigation.
 *
 * Forward is capped at the furthest step reached: later screens read answers
 * from earlier ones, and a resident landing on payment with no passes and no
 * plate sees a summary of nothing and concludes the portal is broken.
 */

const SEGMENTS = ['', 'access', 'household', 'services', 'review', 'confirmation']

const LABELS = [
  'Step 1 of 5 · Welcome',
  'Step 2 of 5 · Your access',
  'Step 3 of 5 · Household access',
  'Step 4 of 5 · Optional services',
  'Step 5 of 5 · Review and payment',
  'Setup complete',
]

const SHORT = ['Welcome', 'Your access', 'Household', 'Services', 'Review', 'Done']

/** The rail covers the five steps a resident works through. */
const RAIL = 5

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
        {Array.from({ length: RAIL }, (_, i) => {
          const now = i === index
          const canGo = reachable(i) && !now && index < RAIL
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
        {index > 0 && index < RAIL ? (
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

/**
 * The promise of the flow, stated accurately.
 *
 * An earlier version of this said the key "works as soon as you finish these
 * steps". It does not: mobile passes are not issued until the parking and
 * amenity fee is paid, and payment happens on the last screen. A resident who
 * read the old line, closed the tab on step 3 and walked to the gate would find
 * it shut — having been told twice that it would open.
 *
 * So the line names the trigger. It is still the reassuring thing to say —
 * there is nothing to wait for in the mail, no appointment, no office visit —
 * but what switches the key on is finishing, and finishing includes paying.
 */
export function PhoneIsYourKey() {
  return (
    <div className="mi-free">
      <span aria-hidden>✓</span>
      Your phone becomes your key. It goes live the moment you finish the last
      step — nothing to wait for in the mail.
    </div>
  )
}
