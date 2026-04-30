// Sprint 2: Resident dashboard — access history, notifications, settings
// Placeholder for authenticated resident view.
// Auth: Supabase magic link → resident row lookup by email

import { Construction } from 'lucide-react'

export default function ResidentPage() {
  return (
    <div className="gc-shell">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">

        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 64, height: 64,
            background: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.2)',
          }}
        >
          <Construction size={28} color="#3B82F6" strokeWidth={1.5} />
        </div>

        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Resident Portal
          </h1>
          <p
            className="text-sm mt-2 max-w-xs"
            style={{ color: 'var(--color-gc-text-secondary)' }}
          >
            The resident dashboard is coming in Sprint 2. You'll be able to view access history, manage guests, and update your contact info.
          </p>
        </div>

        <div
          className="rounded-xl px-4 py-2"
          style={{
            background: 'var(--color-gc-raised)',
            border: '1px solid var(--color-gc-border)',
          }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--color-gc-blue-light)' }}>
            Coming soon
          </span>
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
