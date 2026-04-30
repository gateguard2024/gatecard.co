'use client'

import { useRouter } from 'next/navigation'
import { Package, Users, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react'

interface Site {
  id: string
  slug: string
  name: string
  address: string
  city: string
  state: string
  cover_image_url?: string | null
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

      {/* ── Emergency — top-right corner ──────────────────────── */}
      <button
        onClick={() => router.push(`/${site.slug}/emergency`)}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
        style={{
          background: 'rgba(220,38,38,0.10)',
          border: '1px solid rgba(220,38,38,0.30)',
          color: 'var(--gc-red)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
        }}
        aria-label="Emergency 911"
      >
        <AlertTriangle size={12} strokeWidth={2.5} />
        EMERGENCY 911
      </button>

      {/* ── Property banner ───────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 160 }}
      >
        {site.cover_image_url ? (
          <img
            src={site.cover_image_url}
            alt={site.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          /* Gradient fallback */
          <div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(160deg, #1E3A6E 0%, #0C1827 60%, #080E1A 100%)',
            }}
          >
            {/* Subtle grid pattern */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* Overlay gradient for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(8,14,26,0.92) 0%, rgba(8,14,26,0.3) 60%, transparent 100%)',
          }}
        />

        {/* GateGuard logo */}
        <div className="absolute top-4 left-4">
          <img
            src="/logo.png"
            alt="GateGuard"
            style={{ height: 44, width: 'auto', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
          />
        </div>

        {/* Property name over banner */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <p className="gc-label text-white mb-1" style={{ opacity: 0.5 }}>
            Welcome to
          </p>
          <h1 className="text-2xl font-semibold text-white leading-tight" style={{ letterSpacing: "-0.01em" }}>
            {site.name}
          </h1>
        </div>
      </div>

      {/* ── Address + status ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--gc-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <MapPin size={13} style={{ color: 'var(--gc-text-muted)', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: 'var(--gc-text-secondary)' }}>
            {site.address}, {site.city}, {site.state}
          </span>
        </div>
        <div className="gc-badge-active flex items-center gap-1 shrink-0 ml-3">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{
              background: 'var(--gc-badge-active-fg)',
              animation: 'gc-ring-pulse 2s ease-in-out infinite',
            }}
          />
          SYSTEM ACTIVE
        </div>
      </div>

      {/* ── Resident tap hint ─────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
          style={{
            background: 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(37,99,235,0.14)',
          }}
        >
          <span style={{ fontSize: 15 }}>📱</span>
          <p className="text-xs leading-snug" style={{ color: 'var(--gc-text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--gc-text)' }}>Residents: </span>
            Simply tap your phone or key fob to enter.
          </p>
        </div>
      </div>

      {/* ── Main tiles ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-3 px-4 py-4">

        <p
          className="gc-label mb-1"
          style={{ color: 'var(--gc-text-muted)' }}
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
            className="flex items-center justify-center rounded-2xl shrink-0"
            style={{
              width: 58, height: 58,
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.22)',
            }}
          >
            <Package size={26} color="var(--gc-emerald)" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: 'var(--gc-text)' }}>
              Deliveries
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--gc-text-secondary)' }}>
              Couriers, drop-offs &amp; package room access.
            </div>
          </div>
          <ChevronRight color="var(--gc-text-muted)" />
        </button>

        {/* VISITORS & LEASING */}
        <button
          className="gc-main-tile"
          onClick={() => router.push(`/${site.slug}/visit`)}
          aria-label="Visitors and Leasing"
        >
          <div
            className="flex items-center justify-center rounded-2xl shrink-0"
            style={{
              width: 58, height: 58,
              background: 'rgba(37,99,235,0.10)',
              border: '1px solid rgba(37,99,235,0.22)',
            }}
          >
            <Users size={26} color="var(--gc-blue-light)" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold" style={{ color: 'var(--gc-text)' }}>
              Visitors &amp; Leasing
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--gc-text-secondary)' }}>
              Guest codes, resident directory &amp; tours.
            </div>
          </div>
          <ChevronRight color="var(--gc-text-muted)" />
        </button>

      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        className="flex flex-col gap-2.5 px-5 py-4"
        style={{ borderTop: '1px solid var(--gc-border)' }}
      >
        {/* Tagline */}
        <p
          className="text-center gc-label"
          style={{ letterSpacing: '0.18em', color: 'var(--gc-gold)', opacity: 0.75 }}
        >
          Your whole community. One experience.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            className="text-xs"
            style={{
              color: 'var(--gc-text-muted)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onClick={() => router.push(`/${site.slug}/resident`)}
          >
            Resident PIN Entry
          </button>
          <span style={{ color: 'var(--gc-border-high)' }}>|</span>
          <button
            className="text-xs"
            style={{
              color: 'var(--gc-text-muted)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onClick={() => router.push(`/${site.slug}/leasing`)}
          >
            Call Leasing for Help
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs tabular-nums" style={{ color: 'var(--gc-text-muted)' }}>
            {time} · {date}
          </span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} style={{ color: 'var(--gc-gold)', opacity: 0.6 }} />
            <span className="text-xs" style={{ color: 'var(--gc-text-muted)' }}>
              Secured by GateGuard
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}

function ChevronRight({ color }: { color: string }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
