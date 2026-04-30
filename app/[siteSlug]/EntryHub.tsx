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

export default function EntryHub({ site }: { site: Site }) {
  const router = useRouter()
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      maxWidth: 430,
      margin: '0 auto',
      overflow: 'hidden',
      background: '#0A0A0F',
      animation: 'gc-fade-in 0.5s cubic-bezier(0.22,1,0.36,1) both',
    }}>

      {/* ── Full-bleed background photo ── */}
      {site.cover_image_url && (
        <img
          src={site.cover_image_url}
          alt={site.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Fallback gradient when no photo */}
      {!site.cover_image_url && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, #1C2A4A 0%, #0E1628 50%, #0A0A0F 100%)',
        }} />
      )}

      {/* ── Cinematic overlay gradient ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.05) 22%, rgba(10,10,15,0.55) 52%, rgba(10,10,15,0.96) 74%, #0A0A0F 86%)',
      }} />

      {/* ── Top bar: logo + emergency ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px', zIndex: 20,
      }}>
        <img
          src="/logo.png"
          alt="GateGuard"
          style={{ height: 34, width: 'auto', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))' }}
        />
        <button
          onClick={() => router.push(`/${site.slug}/emergency`)}
          aria-label="Emergency 911"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.28)',
            color: '#EF4444',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <AlertTriangle size={11} strokeWidth={2.5} />
          EMERGENCY
        </button>
      </div>

      {/* ── Property identity — floats on photo like Savant ── */}
      <div style={{
        position: 'absolute',
        bottom: '40%',
        left: 0, right: 0,
        padding: '0 24px',
        zIndex: 10,
        animation: 'gc-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both',
      }}>
        <p style={{
          fontSize: '0.58rem', fontWeight: 600,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(200,164,90,0.65)',
          marginBottom: 10, fontFamily: 'inherit',
        }}>
          Welcome to
        </p>
        <h1 style={{
          fontSize: '2.25rem', fontWeight: 300,
          color: 'white', lineHeight: 1.08,
          letterSpacing: '-0.01em',
          marginBottom: 10, fontFamily: 'inherit',
        }}>
          {site.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={11} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          <span style={{
            fontSize: '0.75rem', fontWeight: 200,
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.02em', fontFamily: 'inherit',
          }}>
            {site.address}, {site.city}, {site.state}
          </span>
        </div>
      </div>

      {/* ── Bottom sheet — tiles float on dark gradient ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '16px 16px 32px',
        zIndex: 10,
        animation: 'gc-fade-up 0.55s cubic-bezier(0.22,1,0.36,1) 0.18s both',
      }}>

        {/* Row: label + badge */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12, padding: '0 4px',
        }}>
          <p className="gc-label" style={{ letterSpacing: '0.14em' }}>How can we help?</p>
          <div className="gc-badge-active">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gc-gold)', display: 'inline-block', animation: 'gc-ring-pulse 2.5s ease-in-out infinite' }} />
            SYSTEM ACTIVE
          </div>
        </div>

        {/* Tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <button
            className="gc-main-tile"
            onClick={() => router.push(`/${site.slug}/packages`)}
            style={{ background: 'rgba(16,16,22,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: 17, flexShrink: 0,
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={26} color="var(--gc-emerald)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--gc-text)', marginBottom: 4, fontFamily: 'inherit' }}>
                Deliveries
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 300, color: 'var(--gc-text-secondary)', lineHeight: 1.35, fontFamily: 'inherit' }}>
                Couriers, drop-offs & package room access.
              </div>
            </div>
            <ChevronRight />
          </button>

          <button
            className="gc-main-tile"
            onClick={() => router.push(`/${site.slug}/visit`)}
            style={{ background: 'rgba(16,16,22,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: 17, flexShrink: 0,
              background: 'rgba(59,111,235,0.10)',
              border: '1px solid rgba(59,111,235,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={26} color="var(--gc-blue-light)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--gc-text)', marginBottom: 4, fontFamily: 'inherit' }}>
                Visitors & Leasing
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 300, color: 'var(--gc-text-secondary)', lineHeight: 1.35, fontFamily: 'inherit' }}>
                Guest codes, resident directory & tours.
              </div>
            </div>
            <ChevronRight />
          </button>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>

          <p style={{
            textAlign: 'center',
            fontSize: '0.58rem', fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--gc-gold)', opacity: 0.55,
            fontFamily: 'inherit',
          }}>
            Your whole community. One experience.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {[
              { label: 'Resident PIN Entry', path: `/${site.slug}/resident` },
              { label: 'Call Leasing', path: `/${site.slug}/leasing` },
            ].map((item, i, arr) => (
              <span key={item.path} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => router.push(item.path)}
                  style={{ fontSize: '0.68rem', fontWeight: 300, color: 'var(--gc-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {item.label}
                </button>
                {i < arr.length - 1 && (
                  <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.08)', display: 'inline-block' }} />
                )}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 200, color: 'var(--gc-text-muted)', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>
              {time} · {date}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={11} color="var(--gc-gold)" style={{ opacity: 0.45 }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 200, color: 'var(--gc-text-muted)', fontFamily: 'inherit' }}>
                Secured by GateGuard
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="var(--gc-text-muted)" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
