import Link from 'next/link'
import type { Property } from '@/lib/types'

/**
 * Initials mark — stands in until a property supplies a wordmark.
 * Connector words are skipped, so "Rhythm at Camp Creek" is RC, not RA.
 */
const SKIP = new Set(['at', 'the', 'of', 'on', 'in', 'by', 'and', '&'])

export function initials(name: string) {
  const words = name.split(/[\s-]+/).filter(w => w && !SKIP.has(w.toLowerCase()))
  return (words.length ? words : name.split(/\s+/))
    .slice(0, 2).map(w => w[0]).join('').toUpperCase()
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
