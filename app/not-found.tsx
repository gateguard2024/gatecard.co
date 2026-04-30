import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="gc-shell">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">

        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 72, height: 72,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <ShieldOff size={34} color="#EF4444" strokeWidth={1.5} />
        </div>

        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Property Not Found
          </h1>
          <p
            className="text-sm mt-2 max-w-xs"
            style={{ color: 'var(--color-gc-text-secondary)' }}
          >
            This QR code doesn't match an active GateGuard property. Please contact your property manager.
          </p>
        </div>

        <div
          className="rounded-2xl p-4 w-full max-w-xs"
          style={{
            background: 'var(--color-gc-surface)',
            border: '1px solid var(--color-gc-border)',
          }}
        >
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            If you believe this is an error, scan the QR code again or ask a staff member for assistance.
          </p>
        </div>

      </main>

      <footer
        className="flex items-center justify-center gap-1.5 px-5 py-4"
        style={{ borderTop: '1px solid var(--color-gc-border)' }}
      >
        <div className="gc-dot" />
        <span className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
          Secured by GateGuard
        </span>
        <div className="gc-dot" />
      </footer>
    </div>
  )
}
