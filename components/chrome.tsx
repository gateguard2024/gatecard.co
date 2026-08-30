import Link from 'next/link'
import type { Property } from '@/lib/types'

/** Initials mark — stands in until a property supplies a wordmark. */
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

/**
 * The property's header. Gate Guard's name does not appear here — the
 * resident's relationship is with their community, not with us.
 */
export function PropertyHeader({ property }: { property: Property }) {
  return (
    <header className="mi-head">
      <div className="mi-head-mark" aria-hidden>{initials(property.name)}</div>
      <div>
        <div className="mi-head-name">{property.name}</div>
        <div className="mi-head-sub">{property.addressLine} · {property.cityState}</div>
      </div>
    </header>
  )
}

/** Subordinate, at the very bottom, once per screen. */
export function GateGuardMark() {
  return <div className="mi-gg">Secured by Gate&nbsp;Guard</div>
}

export function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function money(cents: number) {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`
}

/**
 * Escape hatch. A stale roster sync must never be a dead end — the resident
 * always has a way to reach a human at the property.
 */
export function NotYourUnit({ property }: { property: Property }) {
  return (
    <div className="mi-hatch">
      Not your unit, or something looks wrong?{' '}
      <a href={`tel:${property.leasingPhone}`}>Call the leasing office</a>
      <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-3)' }}>
        {property.leasingHours}
      </div>
    </div>
  )
}

const STEPS = ['', 'access', 'parking', 'services', 'store', 'confirmation']
const LABELS = [
  'Step 1 of 3 · Who you are',
  'Step 2 of 3 · Your access',
  'Step 3 of 3 · Parking',
  'Optional · Services',
  'Optional · Community store',
  'All set',
]

/**
 * Six segments, but the label counts only to three. Activation is the job;
 * screens 04–05 are extra and are labelled as optional, not as remaining work.
 */
export function StepRail({ index }: { index: number }) {
  return (
    <>
      <div className="mi-rail" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={6}>
        {STEPS.map((_, i) => (
          <div key={i} className="mi-rail-seg"
               data-on={i < index ? 'true' : 'false'}
               data-now={i === index ? 'true' : 'false'} />
        ))}
      </div>
      <div className="mi-rail-label">{LABELS[index]}</div>
    </>
  )
}

export function StepFooter({
  href, label, disabled, secondary,
}: { href: string; label: string; disabled?: boolean; secondary?: React.ReactNode }) {
  return (
    <div className="mi-foot">
      {disabled
        ? <button className="mi-btn" disabled>{label}</button>
        : <Link href={href} className="mi-btn">{label}</Link>}
      {secondary}
    </div>
  )
}
