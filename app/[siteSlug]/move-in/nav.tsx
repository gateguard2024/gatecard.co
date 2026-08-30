'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useMoveIn } from './state'

/**
 * Step navigation.
 *
 * Browser back works, but there is no visible control — and this is used on a
 * phone, outdoors, sometimes installed to the home screen where there is no
 * browser chrome at all. So the rail itself is the navigation.
 *
 * What it deliberately does NOT allow: jumping forward past where you've got
 * to. Screens 04–06 read answers from 01–03, and a resident who lands on the
 * confirmation without a plate or a phone number sees a summary of nothing and
 * assumes the portal is broken. Segments beyond your furthest step are inert.
 */

const SEGMENTS = ['', 'access', 'parking', 'services', 'store', 'confirmation']

const LABELS = [
  'Step 1 of 3 · Who you are',
  'Step 2 of 3 · Your access',
  'Step 3 of 3 · Parking',
  'Optional · Services',
  'Optional · Community store',
  'All set',
]

const SHORT = ['Who you are', 'Your access', 'Parking', 'Services', 'Store', 'All set']

export function StepNav({ index }: { index: number }) {
  const { ctx, s, set } = useMoveIn()
  const base = `/${ctx.property.slug}/move-in`

  // Reaching a step is what unlocks it. Recorded here rather than at each
  // "Continue", so arriving by any route — rail, browser back, a reload —
  // keeps the same record.
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
          const on = i < index
          const now = i === index
          const canGo = reachable(i) && !now

          const seg = (
            <span className="mi-rail-seg"
                  data-on={on ? 'true' : 'false'}
                  data-now={now ? 'true' : 'false'} />
          )

          // A segment you can't reach yet is not a link and not focusable —
          // it shouldn't invite a tap that does nothing.
          return canGo ? (
            <Link key={i} href={href(i)} className="mi-rail-hit"
                  aria-label={`Go to ${SHORT[i]}`}>
              {seg}
            </Link>
          ) : (
            <span key={i} className="mi-rail-hit" aria-current={now ? 'step' : undefined}>
              {seg}
            </span>
          )
        })}
      </nav>

      <div className="mi-rail-row">
        {index > 0 ? (
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
