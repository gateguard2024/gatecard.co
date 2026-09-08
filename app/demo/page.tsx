import Link from 'next/link'
import { PROPERTIES, DEMO_NOTES } from '@/lib/mock/properties'
import { initials, money } from '@/components/chrome'
import { computeFee } from '@/lib/fees'
import {
  PhoneKeyArt, CarArt, FobArt, WifiArt, WalletArt,
} from '@/components/art'

export const dynamic = 'force-dynamic'

/**
 * The demo site.
 *
 * Not the resident's portal and not the engineering index — this is the screen
 * you put on a laptop in front of a property manager. It answers the three
 * questions they actually ask, in order: what does my resident see, what do my
 * staff stop doing, and what does it look like at MY property.
 *
 * Everything below reads from the same mock data the portal does, so a number
 * quoted here cannot drift from the number on the screen you then walk them
 * through.
 */

const STEPS = [
  {
    art: PhoneKeyArt,
    title: 'Who you are',
    resident: 'Confirms the household and takes one mobile number.',
    manager: 'Passes are granted per person from one link — no separate invite per adult.',
  },
  {
    art: CarArt,
    title: 'Vehicles',
    resident: 'Adds a plate for each person with a pass.',
    manager: 'Plates arrive attached to a named resident, not to a unit.',
  },
  {
    art: FobArt,
    title: 'Physical keys',
    resident: 'Orders an optional fob or tag as a backup.',
    manager: 'Capped at one per active pass. Keys ship inert and enrol on first tap.',
  },
  {
    art: WifiArt,
    title: 'Home services',
    resident: 'Turns on internet, TV, insurance — whatever you offer.',
    manager: 'Your offer table decides what appears. Commission is tracked per order.',
  },
  {
    art: WalletArt,
    title: 'Review and pay',
    resident: 'One summary, one card, done.',
    manager: 'The parking and amenity fee is collected here, at sign-up.',
  },
]

const REMOVED = [
  'Chasing a resident for a plate and a phone number',
  'Creating the Brivo user, the group and the unit site by hand',
  'Handing out a fob and writing down who took it',
  'Fielding “my key doesn’t work” on move-in weekend',
  'Collecting the parking and amenity fee at the desk',
]

export default function DemoSite() {
  const list = Object.values(PROPERTIES)

  return (
    <div className="mi-shell" style={{ maxWidth: 860 }}>
      <div className="mi-body" style={{ paddingTop: '2.5rem' }}>

        <div className="mi-demo" style={{ marginBottom: '1.25rem' }}>
          Demo · invented properties and residents, no payments taken
        </div>

        <h1 className="mi-h1" style={{ fontSize: '2.125rem' }}>
          Your resident opens one link and their gate works.
        </h1>
        <p className="mi-lede" style={{ fontSize: '1.0625rem', maxWidth: '52ch' }}>
          Five screens, about two minutes, on the phone they already have.
          Nobody visits the leasing office to get a key, and nobody at the desk
          types anything into Brivo.
        </p>

        {/* ── The five screens ───────────────────────────────────────────── */}
        <div className="mi-state-h">What the resident does</div>
        <div className="mi-card">
          {STEPS.map((st, i) => {
            const Art = st.art
            return (
              <div key={st.title} className="mi-card-p"
                   style={{ borderTop: i ? '1px solid var(--line)' : 'none',
                            display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                <div className="mi-art-inline"><Art size={52} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700,
                                   color: 'var(--text-3)', letterSpacing: '0.06em' }}>
                      {i + 1}
                    </span>
                    <span className="mi-prod-title" style={{ fontSize: '1rem' }}>
                      {st.title}
                    </span>
                  </div>
                  <p className="mi-opt-blurb" style={{ margin: '0.125rem 0 0' }}>
                    {st.resident}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent-hi)',
                              margin: '0.3125rem 0 0', fontWeight: 550 }}>
                    {st.manager}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Walkthroughs ──────────────────────────────────────────────── */}
        <div className="mi-state-h">Walk it as a resident</div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0 0 0.875rem' }}>
          Three properties on one deployment. No property name appears anywhere
          in the five screens — where they differ, it is because the property
          record differs.
        </p>

        <div style={{ display: 'grid', gap: '0.875rem' }}>
          {list.map(ctx => {
            const note = DEMO_NOTES[ctx.property.slug]
            const fee = computeFee({
              fee: ctx.property.parkingFee,
              concession: ctx.resident.concession,
              termMonths: ctx.resident.leaseTermMonths,
            })
            return (
              <div key={ctx.property.slug} className="mi-card mi-card-p"
                   style={{ ['--accent' as string]: ctx.property.accent }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                  <div className="mi-head-mark" aria-hidden>
                    {initials(ctx.property.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mi-prod-title" style={{ fontSize: '1.0625rem' }}>
                      {ctx.property.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                      {ctx.property.cityState} · {ctx.resident.firstName}{' '}
                      {ctx.resident.lastName}, unit {ctx.resident.unitNumber} ·{' '}
                      {ctx.resident.household.length} on the lease
                    </div>
                  </div>
                  {fee && (
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700,
                                    letterSpacing: '-0.02em',
                                    color: fee.netCents === 0 ? 'var(--ok)' : undefined }}>
                        {fee.netCents === 0 ? 'Comped' : money(fee.netCents)}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-3)',
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                    fontWeight: 700 }}>
                        due at sign-up
                      </div>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.875rem', fontWeight: 550, margin: '0.875rem 0 0.5rem' }}>
                  {note?.headline}
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem',
                             color: 'var(--text-2)', lineHeight: 1.65 }}>
                  {note?.points.map(pt => <li key={pt}>{pt}</li>)}
                </ul>

                <Link href={`/${ctx.property.slug}/move-in`} className="mi-btn"
                      style={{ marginTop: '1rem' }}>
                  Start {ctx.resident.firstName}&apos;s walkthrough
                </Link>
              </div>
            )
          })}
        </div>

        {/* ── What goes away ────────────────────────────────────────────── */}
        <div className="mi-state-h">What your staff stops doing</div>
        <div className="mi-card mi-card-p">
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem',
                       color: 'var(--text-2)', lineHeight: 1.75 }}>
            {REMOVED.map(r => <li key={r}>{r}</li>)}
          </ul>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', margin: '0.875rem 0 0' }}>
            Move-ins and move-outs are detected from your access-control roster,
            so the portal follows the lease without anyone re-keying it.
          </p>
        </div>

        <div className="mi-card mi-card-p" style={{ marginTop: '0.875rem' }}>
          <div className="mi-prod-title" style={{ fontSize: '1rem' }}>
            What the automation sends
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0.375rem 0 0.875rem' }}>
            The move-in and move-out emails are the part nobody sees until it is
            live. These are the real templates, rendered with demo data.
          </p>
          <Link href="/demo/emails" className="mi-btn mi-btn-2">See the emails</Link>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.5rem' }}>
          Every property, resident, address and price on this site is invented.
          Prices are placeholders and came from nobody. No payment is taken
          anywhere in this demo.
        </p>
      </div>
      <div className="mi-gg">Secured by Gate&nbsp;Guard</div>
    </div>
  )
}
