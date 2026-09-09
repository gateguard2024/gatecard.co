'use client'

import { StepFooter, money } from '@/components/chrome'
import { StepNav, StripeMark, PhoneIsYourKey } from '../nav'
import { useMoveIn, vehicleHalfDone, addOnPrice } from '../state'
import { AddOnPicker, VehicleFields, Avatar } from '@/components/move-in-parts'

/**
 * 03 · Household access
 *
 * One card per person on the lease. Switching someone on expands their card
 * into the same controls the primary resident just used: a physical add-on and
 * a vehicle.
 *
 * Granting a pass is a real act — one adult is provisioning building access for
 * another — so it is deliberately explicit, one card per person, rather than a
 * row of checkboxes. It defaults off for everyone except people the roster
 * already shows with access.
 *
 * The fee does not move. It is charged once for the unit, and this screen says
 * so plainly, because "add a person" reading as "add a charge" is exactly the
 * hesitation that leaves a spouse without a key.
 */
export default function HouseholdAccess() {
  const { ctx, s, setMember } = useMoveIn()
  const siteSlug = ctx.property.slug
  const { property, resident } = ctx

  const others = resident.household.filter(m => m.role !== 'me')
  const fee = property.parkingFee

  const halfDone = others.some(m => s.members[m.id]?.pass && vehicleHalfDone(s.members[m.id]))
  const ready = !halfDone

  const addOnTotal = resident.household.reduce((n, m) => {
    const sel = s.members[m.id]
    return sel?.pass ? n + addOnPrice(ctx, sel.addOn) : n
  }, 0)

  const granted = others.filter(m => s.members[m.id]?.pass).length

  const ROLE: Record<string, string> = {
    leaseholder: 'Leaseholder', occupant: 'Occupant', me: 'You',
  }

  if (others.length === 0) {
    return (
      <>
        <StepNav index={2} />
        <div className="mi-body">
          <h1 className="mi-h1">Household access</h1>
          <PhoneIsYourKey />
          <div className="mi-card mi-card-p">
            <div className="mi-opt-title">You&apos;re the only one on this lease</div>
            <p className="mi-opt-blurb" style={{ margin: '0.25rem 0 0' }}>
              Nothing to do here. If someone joins your lease later, the leasing
              office adds them and they get their own link.
            </p>
          </div>
        </div>
        <StepFooter href={`/${siteSlug}/move-in/services`}
                    label="Next: Optional services" />
        <StripeMark />
      </>
    )
  }

  return (
    <>
      <StepNav index={2} />
      <div className="mi-body">
        <h1 className="mi-h1">Household access</h1>
        <p className="mi-lede">
          Choose who else on your lease gets a phone key.
        </p>
        <PhoneIsYourKey />

        {fee && (
          <div className="mi-note">
            <div className="mi-note-row">
              <span>Phone keys for your household</span>
              <b>No extra charge</b>
            </div>
            <p>
              The {money(fee.amountCents)} {fee.label.toLowerCase()} is charged
              once for Unit {resident.unitNumber}. Everyone on the lease can have
              a phone key under that one fee. Only the physical add-ons below
              cost anything.
            </p>
          </div>
        )}

        {others.map(m => {
          const sel = s.members[m.id]
          const on = sel?.pass
          return (
            <div key={m.id} className="mi-card mi-card-p"
                 style={{ marginBottom: '0.75rem',
                          borderColor: on ? 'var(--accent)' : undefined }}>
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                <Avatar first={m.firstName} last={m.lastName} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mi-prod-title" style={{ fontSize: '1rem' }}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {m.alreadyActive ? 'Already on the roster' : ROLE[m.role]}
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="mi-switch"
                  checked={Boolean(on)}
                  disabled={m.alreadyActive}
                  onChange={e => setMember(m.id, { pass: e.target.checked })}
                  aria-label={`${on ? 'Remove' : 'Send'} a phone key for ${m.firstName}`}
                />
              </div>

              {on && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem',
                              borderTop: '1px solid var(--line)' }}>
                  <div className="mi-label">
                    Optional add-on for {m.firstName}
                  </div>
                  <AddOnPicker
                    credentials={ctx.credentials}
                    value={sel.addOn}
                    onChange={k => setMember(m.id, { addOn: k })}
                    name={m.firstName}
                  />

                  <div className="mi-label" style={{ marginTop: '1.25rem' }}>
                    {m.firstName}&apos;s vehicle
                  </div>
                  <VehicleFields
                    id={m.id}
                    sel={sel}
                    onChange={patch => setMember(m.id, patch)}
                    name={m.firstName}
                  />
                  {vehicleHalfDone(sel) && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--warn)', marginTop: '0.5rem' }}>
                      {m.firstName}&apos;s vehicle is missing a plate or a state —
                      finish it, or tick &ldquo;No vehicle&rdquo;.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="mi-counter">
          <span>Phone keys: <b>{granted + 1}</b> (you and {granted} other{granted === 1 ? '' : 's'})</span>
          <span>Add-ons: <b>{money(addOnTotal)}</b> one-time</span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.75rem' }}>
          A phone key is issued to that person by name and can be removed at any
          time from your resident app. Anyone you skip can be added later.
        </p>
      </div>

      <StepFooter
        href={`/${siteSlug}/move-in/services`}
        label={ready ? 'Next: Optional services' : 'Finish the vehicle above'}
        disabled={!ready}
      />
      <StripeMark />
    </>
  )
}
