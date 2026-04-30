'use client'

import { useRouter } from 'next/navigation'
import { Package, Users, AlertTriangle } from 'lucide-react'

interface Site {
  id: string
  slug: string
  name: string
  address: string
  city: string
  state: string
}

interface Props {
  site: Site
}

export default function EntryHub({ site }: Props) {
  const router = useRouter()

  const now  = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="gc-shell" style={{ position: 'relative' }}>

      {/* ── Emergency button — top-right corner ───────────────── */}
      <button
        onClick={() => router.push(`/${site.slug}/emergency`)}
        className="absolute top-5 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg z-10"
        style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.35)',
          color: '#FCA5A5',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
        aria-label="Emergency 911"
      >
        <AlertTriangle size={13} strokeWidth={2.5} />
        EMERGENCY 911
      </button>

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="px-5 pt-10 pb-6" style={{ borderBottom: '1px solid var(--color-gc-border)' }}>

        {/* GateCard wordmark */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="14" height="14" rx="2" stroke="white" strokeWidth="1.5"/>
              <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--color-gc-text-muted)', letterSpacing: '0.1em' }}
          >
            GATECARD
          </span>
        </div>

        {/* Property name */}
        <p className="text-2xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
          Welcome to
        </p>
        <p
          className="text-2xl font-bold"
          style={{
            background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {site.name}
        </p>

        {/* Resident tap-in hint */}
        <div
          className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(37,99,235,0.07)',
            border: '1px solid rgba(37,99,235,0.15)',
          }}
        >
          <span style={{ fontSize: 16 }}>📱</span>
          <p className="text-xs leading-snug" style={{ color: 'var(--color-gc-text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-gc-text)' }}>Residents: </span>
            Simply tap your phone or key fob to enter.
          </p>
        </div>
      </header>

      {/* ── Main tiles ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-3.5 px-4 py-5">

        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--color-gc-text-muted)' }}
        >
          How can we help you today?
        </p>

        {/* DELIVERIES */}
        <button
          className="gc-main-tile"
          onClick={() => router.push(`/${site.slug}/packages`)}
          aria-label="Deliveries"
        >
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 60, height: 60,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            <Package size={28} color="#10B981" strokeWidth={1.5} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
              Deliveries
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Couriers, drop-offs &amp; package room access.
            </div>
          </div>
          <ChevronRight />
        </button>

        {/* VISITORS & LEASING */}
        <button
          className="gc-main-tile"
          onClick={() => router.push(`/${site.slug}/visit`)}
          aria-label="Visitors and Leasing"
        >
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 60, height: 60,
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.25)',
            }}
          >
            <Users size={28} color="#3B82F6" strokeWidth={1.5} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
              Visitors &amp; Leasing
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Guest codes, resident directory &amp; tours.
            </div>
          </div>
          <ChevronRight />
        </button>

      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        className="flex flex-col items-center gap-3 px-5 py-4"
        style={{ borderTop: '1px solid var(--color-gc-border)' }}
      >
        {/* Utility links */}
        <div className="flex items-center gap-3">
          <button
            className="text-xs"
            style={{ color: 'var(--color-gc-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            onClick={() => router.push(`/${site.slug}/resident`)}
          >
            Resident PIN Entry
          </button>
          <span style={{ color: 'var(--color-gc-border)' }}>|</span>
          <button
            className="text-xs"
            style={{ color: 'var(--color-gc-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            onClick={() => router.push(`/${site.slug}/leasing`)}
          >
            Call Leasing Office for Help
          </button>
        </div>

        {/* Time + branding */}
        <div className="flex items-center justify-between w-full">
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-gc-text-muted)' }}>
            {time} · {date}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="gc-dot" />
            <span className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
              Secured by GateGuard
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}

function ChevronRight() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--color-gc-text-muted)', flexShrink: 0 }}
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
