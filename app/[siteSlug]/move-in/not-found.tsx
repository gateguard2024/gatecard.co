import Link from 'next/link'

/**
 * A bare 404 here is the worst possible answer.
 *
 * Two very different people reach this page: a resident whose link is wrong or
 * whose roster row hasn't synced yet, and one of us looking at a deployment
 * that is pointed at the wrong database. The default "404 — This page could
 * not be found" serves neither, and it is what turns a missing environment
 * variable into ten minutes of confusion.
 */
export default function MoveInNotFound() {
  return (
    <div className="mi-shell">
      <div className="mi-body" style={{ paddingTop: '3rem' }}>
        <h1 className="mi-h1">We couldn&apos;t find that community</h1>
        <p className="mi-lede">
          The link may be mistyped, or your lease may not have reached us yet —
          it usually takes a few hours after your leasing office posts it.
        </p>

        <div className="mi-hatch">
          <b>If you&apos;re a resident:</b> check the link in your email, or call
          your leasing office and ask them to resend it. Your move-in is not
          affected by this page.
        </div>

        <div className="mi-hatch" style={{ marginTop: '0.875rem' }}>
          <b>If you&apos;re testing a deployment:</b> the site slug resolved to
          nothing in the configured data source. On a demo deployment set{' '}
          <code>DEMO_MODE=1</code> and redeploy; otherwise check that the site
          exists and has <code>move_in_enabled</code> set.
        </div>

        <Link href="/demo" className="mi-btn" style={{ marginTop: '1.5rem' }}>
          See the demo properties
        </Link>
      </div>
      <div className="mi-gg">Secured by Gate&nbsp;Guard</div>
    </div>
  )
}
