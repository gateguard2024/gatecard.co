import Link from 'next/link'
import { PROPERTIES, DEMO_NOTES } from '@/lib/mock/properties'
import { dataSource } from '@/lib/data'
import { initials } from '@/components/chrome'

export const dynamic = 'force-dynamic'

/**
 * Demo index.
 *
 * gatecard.co is a per-property portal — there is no global resident landing
 * page. This is the way in while the app runs on mock data, and it exists to
 * make the offer engine visible: three properties, no property names anywhere
 * in the screens, and they render differently purely because their data does.
 */
export default function Home() {
  const live = dataSource() === 'supabase'

  return (
    <div className="mi-shell" style={{ maxWidth: 760 }}>
      <div className="mi-body" style={{ paddingTop: '2.5rem' }}>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.3125rem 0.625rem', borderRadius: '0.5rem',
          background: live
            ? 'color-mix(in srgb, var(--ok) 14%, transparent)'
            : 'color-mix(in srgb, var(--warn) 14%, transparent)',
          border: `1px solid color-mix(in srgb, ${live ? 'var(--ok)' : 'var(--warn)'} 30%, transparent)`,
          color: live ? 'var(--ok)' : 'var(--warn)',
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {live ? 'Live data' : 'Demo data · nothing here is real'}
        </div>

        <h1 className="mi-h1" style={{ fontSize: '2rem', marginTop: '1rem' }}>
          GateCard move-in
        </h1>
        <p className="mi-lede" style={{ fontSize: '1rem', maxWidth: '46ch' }}>
          Three properties, one deployment. None of the six screens contains a
          property name — where they differ, it&apos;s because the data differs.
        </p>

        <div style={{ display: 'grid', gap: '0.875rem' }}>
          {Object.values(PROPERTIES).map(ctx => {
            const note = DEMO_NOTES[ctx.property.slug]
            return (
              <div key={ctx.property.slug} className="mi-card mi-card-p"
                   style={{ ['--accent' as string]: ctx.property.accent }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                  <div className="mi-head-mark" aria-hidden>
                    {initials(ctx.property.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.015em' }}>
                      {ctx.property.name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                      {ctx.property.cityState} · {ctx.resident.firstName} {ctx.resident.lastName},
                      unit {ctx.resident.unitNumber}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', fontWeight: 550, margin: '0.875rem 0 0.5rem' }}>
                  {note?.headline}
                </p>
                <ul style={{
                  margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem',
                  color: 'var(--text-2)', lineHeight: 1.65,
                }}>
                  {note?.points.map(pt => <li key={pt}>{pt}</li>)}
                </ul>

                <Link href={`/${ctx.property.slug}/move-in`} className="mi-btn"
                      style={{ marginTop: '1rem' }}>
                  Walk {ctx.resident.firstName}&apos;s move-in
                </Link>
              </div>
            )
          })}
        </div>

        <div className="mi-card mi-card-p" style={{ marginTop: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>What the automation sends</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0.375rem 0 0.875rem' }}>
            The move-in and move-out emails are the part nobody sees until it&apos;s
            live. These are the real templates, rendered with demo data.
          </p>
          <Link href="/demo/emails" className="mi-btn mi-btn-2">See the emails</Link>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '1.5rem' }}>
          Every property, resident, price and address on this site is invented.
          Prices in particular are placeholders and came from nobody.
        </p>
      </div>
      <div className="mi-gg">Secured by Gate&nbsp;Guard</div>
    </div>
  )
}
