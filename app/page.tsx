import Link from 'next/link'

/**
 * Root. gatecard.co is a per-property portal — there is no global landing page
 * yet. This is a dev index into the mock property.
 */
export default function Home() {
  return (
    <div className="mi-shell">
      <div className="mi-body" style={{ paddingTop: '4rem' }}>
        <h1 className="mi-h1">GateCard</h1>
        <p className="mi-lede">Resident move-in portal · v8.31 · mock data</p>
        <Link href="/east-ponds/move-in" className="mi-btn">Open East Ponds move-in</Link>
      </div>
    </div>
  )
}
