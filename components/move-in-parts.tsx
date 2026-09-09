'use client'

import { money } from '@/components/chrome'
import { FobArt, KeyTagArt } from '@/components/art'
import { EMPTY_VEHICLE } from '@/app/[siteSlug]/move-in/state'
import type {
  AddOnKind, CredentialOption, MemberSelection, VehicleDraft,
} from '@/lib/types'

/**
 * The two blocks that repeat per person — the add-on picker and the vehicle
 * form. Shared between "Your access" and "Household access" so the primary
 * resident and a housemate see exactly the same controls in the same order.
 *
 * They are identical on purpose. A household member who is offered a different
 * set of choices than the leaseholder reads as a second-class resident, and
 * the leaseholder is the one who notices.
 */

const ART: Record<string, (p: { size: number }) => React.JSX.Element> = {
  fob: FobArt,
  keytag: KeyTagArt,
}

const BLURB: Record<string, string> = {
  fob: 'A plastic visor fob for your car or bag.',
  keytag: 'A small tag that clips right on your keyring.',
}

/**
 * One physical credential, or none.
 *
 * Either/or rather than a quantity: a credential is enrolled against a named
 * person in Brivo, and a second one in the same pocket is a spare key to the
 * community that belongs to nobody in particular.
 */
export function AddOnPicker({
  credentials, value, onChange, name,
}: {
  credentials: CredentialOption[]
  value: AddOnKind
  onChange: (k: AddOnKind) => void
  /** Whose add-on this is, for the accessible label. */
  name: string
}) {
  const physical = credentials.filter(c => c.isPhysical)
  if (physical.length === 0) return null

  const pick = (k: AddOnKind) => onChange(value === k ? 'none' : k)

  return (
    <div>
      {physical.map(c => {
        const k = c.kind as 'fob' | 'keytag'
        const Art = ART[k]
        const on = value === k
        return (
          <label key={c.kind} className="mi-opt" data-sel={on ? 'true' : 'false'}>
            <input
              type="checkbox"
              checked={on}
              onChange={() => pick(k)}
              aria-label={`${on ? 'Remove' : 'Add'} a ${c.label} for ${name}`}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span className="mi-art-inline" style={{ width: 46 }}>
              {Art ? <Art size={44} /> : null}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mi-opt-title">{c.label}</div>
              <div className="mi-opt-blurb">{c.blurb || BLURB[k]}</div>
            </div>
            <span className="mi-price">{money(c.priceCents)}</span>
          </label>
        )
      })}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '0.5rem 0 0' }}>
        One physical key per person — a fob or a tag, not both. Optional, and it
        ships by mail. Your phone key works either way.
      </p>
    </div>
  )
}

/**
 * A plate, or an explicit "no vehicle".
 *
 * The opt-out is a real control rather than a link, because a resident with no
 * car who cannot get past a required field will call the leasing office, and
 * the leasing office will call us.
 */
export function VehicleFields({
  id, sel, onChange, name,
}: {
  id: string
  sel: MemberSelection
  onChange: (patch: Partial<MemberSelection>) => void
  name: string
}) {
  const v: VehicleDraft = sel.vehicle ?? EMPTY_VEHICLE
  const setV = (patch: Partial<VehicleDraft>) =>
    onChange({ vehicle: { ...v, ...patch }, noVehicle: false })

  return (
    <div>
      <label className="mi-opt" data-sel={sel.noVehicle ? 'true' : 'false'}
             style={{ marginBottom: '0.625rem' }}>
        <input
          type="checkbox"
          checked={sel.noVehicle}
          onChange={e => onChange({
            noVehicle: e.target.checked,
            vehicle: e.target.checked ? null : v,
          })}
          aria-label={`${name} has no vehicle`}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span className="mi-tick">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div style={{ flex: 1 }}>
          <div className="mi-opt-title">No vehicle</div>
          <div className="mi-opt-blurb">
            The phone key still opens the gate on foot.
          </div>
        </div>
      </label>

      {!sel.noVehicle && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: '0.5rem' }}>
            <div>
              <label className="mi-label" htmlFor={`plate-${id}`}>Plate number</label>
              <input id={`plate-${id}`} className="mi-input" autoCapitalize="characters"
                     placeholder="ABC 1234" value={v.plate}
                     onChange={e => setV({ plate: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="mi-label" htmlFor={`state-${id}`}>State</label>
              <input id={`state-${id}`} className="mi-input" maxLength={2}
                     autoCapitalize="characters" placeholder="GA" value={v.state}
                     onChange={e => setV({ state: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
                        marginTop: '0.625rem' }}>
            <div>
              <label className="mi-label" htmlFor={`make-${id}`}>Make</label>
              <input id={`make-${id}`} className="mi-input" placeholder="Honda" value={v.make}
                     onChange={e => setV({ make: e.target.value })} />
            </div>
            <div>
              <label className="mi-label" htmlFor={`model-${id}`}>Model</label>
              <input id={`model-${id}`} className="mi-input" placeholder="Civic" value={v.model}
                     onChange={e => setV({ model: e.target.value })} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Initials mark for a person, when there's no headshot. */
export function Avatar({ first, last }: { first: string; last: string }) {
  return (
    <div className="mi-avatar">
      {`${first.charAt(0)}${last.charAt(0)}`.toUpperCase()}
    </div>
  )
}
