import Link from 'next/link'
import { staffDigestHtml, residentInviteHtml } from '@/lib/notify'
import { PROPERTIES } from '@/lib/mock/properties'

export const dynamic = 'force-dynamic'

/**
 * The emails, rendered.
 *
 * These templates are otherwise invisible until the day they go out to real
 * residents, which is a bad time to first look at them. Same functions the
 * lifecycle sync calls — not copies.
 */
export default function EmailPreview() {
  const ctx = PROPERTIES['east-ponds']
  const accent = ctx.property.accent

  const digest = staffDigestHtml({
    propertyName: ctx.property.name,
    accent,
    movedIn: [
      { firstName: 'Maya', lastName: 'Ellison', unitNumber: '214',
        email: 'm.ellison@example.com', phone: '+14045550142',
        inviteUrl: 'https://gatecard.co/east-ponds/move-in?invite=demo' },
      // Deliberately incomplete — this is what the digest does with a resident
      // Brivo gave us nothing for.
      { firstName: 'Chris', lastName: 'Nolan', unitNumber: null,
        email: null, phone: null, inviteUrl: null },
    ],
    movedOut: [{ firstName: 'Dana', lastName: 'Whitfield', unitNumber: '108' }],
    unitChanged: [{ firstName: 'Sam', lastName: 'Boyd', from: '101', to: '306' }],
    guard: null,
    needsAttention: [
      'Chris Nolan has no unit number in Brivo — they cannot be sent a parking registration until it’s set.',
      'Chris Nolan has no email or phone in Brivo — their link has to be handed over at the leasing office.',
    ],
  })

  const guarded = staffDigestHtml({
    propertyName: ctx.property.name,
    accent,
    movedIn: [], movedOut: [], unitChanged: [],
    guard: 'Roster fell from 832 to 100 (88.0% > 15% allowed). Treating as a bad pull.',
    needsAttention: [],
  })

  const invite = residentInviteHtml({
    propertyName: ctx.property.name,
    accent,
    firstName: 'Maya',
    unitNumber: '214',
    inviteUrl: 'https://gatecard.co/east-ponds/move-in?invite=demo',
    leasingPhone: ctx.property.leasingPhone,
  })

  const Frame = ({ title, note, html }: { title: string; note: string; html: string }) => (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: '1.0625rem', margin: '0 0 0.25rem', letterSpacing: '-0.015em' }}>{title}</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', margin: '0 0 0.875rem' }}>{note}</p>
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)' }}
           dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )

  return (
    <div className="mi-shell" style={{ maxWidth: 760 }}>
      <div className="mi-body" style={{ paddingTop: '2rem' }}>
        <Link href="/" style={{ fontSize: '0.8125rem', color: 'var(--accent-hi)',
                                textDecoration: 'none', fontWeight: 600 }}>
          ← Back
        </Link>
        <h1 className="mi-h1" style={{ fontSize: '1.75rem' }}>What the automation sends</h1>
        <p className="mi-lede">
          Rendered with the same functions the sync calls. Demo data throughout.
        </p>

        <Frame
          title="Staff digest — one per sync run"
          note="Not one email per resident. A property leasing up forty units in an afternoon would otherwise send forty, which trains staff to filter you to trash by week one."
          html={digest}
        />
        <Frame
          title="Staff digest — when the sync is held back"
          note="What arrives instead when the shrink guard trips. It says plainly that nothing was processed and nobody lost access, because the alternative is a leasing manager assuming the worst."
          html={guarded}
        />
        <Frame
          title="Resident invite"
          note="Gated per property and off by default. One link, one job — register the vehicle and set up gate access."
          html={invite}
        />
      </div>
      <div className="mi-gg">Secured by Gate&nbsp;Guard</div>
    </div>
  )
}
