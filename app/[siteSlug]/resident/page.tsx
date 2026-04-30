'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

// ─── Feature → icon + label + route mapping ──────────────────────────────────
// SVG path data for each module icon
const ICON_PATHS: Record<string, string> = {
  gates:             'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  doors:             'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  visitors:          'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  packages:          'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  community_channel: 'M7 4V2m10 2V2M5 8h14M5 8a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2M5 8h14m-5 4v4m-4-4v4',
  cameras:           'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  energy:            'M13 10V3L4 14h7v7l9-11h-7z',
  network:           'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
  smart_locks:       'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  climate:           'M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2',
  service_request:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  music:             'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
}

const ICON_LABELS: Record<string, string> = {
  gates:             'Gates',
  doors:             'Doors',
  visitors:          'Visitors',
  packages:          'Packages',
  community_channel: 'Community',
  cameras:           'Cameras',
  energy:            'Energy',
  network:           'Network',
  smart_locks:       'Smart Locks',
  climate:           'Climate',
  service_request:   'Service',
  music:             'Music',
}

// Resident-visible modules (ordered as drawn)
const RESIDENT_MODULES = [
  'gates', 'doors', 'packages', 'community_channel',
  'cameras', 'energy', 'smart_locks', 'climate', 'service_request', 'music',
]

// Admin-only additions
const ADMIN_EXTRA_MODULES = ['visitors', 'network']

// ─── Accent colors per module ─────────────────────────────────────────────────
const MODULE_COLORS: Record<string, string> = {
  gates:             '#C8A45A',
  doors:             '#C8A45A',
  visitors:          '#5B87F5',
  packages:          '#10B981',
  community_channel: '#8B5CF6',
  cameras:           '#3B6FEB',
  energy:            '#F59E0B',
  network:           '#06B6D4',
  smart_locks:       '#C8A45A',
  climate:           '#3B82F6',
  service_request:   '#EC4899',
  music:             '#A855F7',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SiteData {
  name: string
  address: string
  city: string
  state: string
  cover_image_url: string | null
  features: Record<string, boolean>
}

// ─── Icon tile ────────────────────────────────────────────────────────────────
function ModuleIcon({ moduleKey, color }: { moduleKey: string; color: string }) {
  const path = ICON_PATHS[moduleKey]
  const label = ICON_LABELS[moduleKey]

  return (
    <button
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget.querySelector('.icon-tile') as HTMLElement
        if (el) {
          el.style.transform = 'translateY(-3px) scale(1.04)'
          el.style.borderColor = color
          el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}40`
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget.querySelector('.icon-tile') as HTMLElement
        if (el) {
          el.style.transform = ''
          el.style.borderColor = 'rgba(255,255,255,0.08)'
          el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
        }
      }}
    >
      {/* Icon square */}
      <div
        className="icon-tile"
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(16,16,22,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <svg
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {path.includes('M15 12') && path.includes('M10.325') ? (
            // service_request has two paths
            <>
              <path d={path.split(' M15 12')[0]} />
              <path d={'M15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
            </>
          ) : (
            <path d={path} />
          )}
        </svg>
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: '0.62rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-montserrat, sans-serif)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ResidentDashboard() {
  const params = useParams()
  const siteSlug = params?.siteSlug as string
  const [site, setSite] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // TODO Sprint 2: read role from Supabase auth session
  const role: 'resident' | 'admin' = 'resident'

  useEffect(() => {
    if (!siteSlug) return
    fetch(`/api/sites/${siteSlug}`)
      .then(r => r.json())
      .then(data => { setSite(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [siteSlug])

  const features = site?.features ?? {}

  const modules = role === 'admin'
    ? [...RESIDENT_MODULES, ...ADMIN_EXTRA_MODULES]
    : RESIDENT_MODULES

  const visibleModules = modules.filter(m => features[m])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(200,164,90,0.3)', borderTopColor: '#C8A45A', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-montserrat, sans-serif)', overflowX: 'hidden' }}>

      {/* ── Hero photo + header ───────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 260, flexShrink: 0 }}>
        {site?.cover_image_url ? (
          <Image
            src={site.cover_image_url}
            alt={site.name}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
            priority
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1C2A4A 0%, #0A0A0F 100%)' }} />
        )}
        {/* Gradient fade to black */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.1) 40%, rgba(10,10,15,0.85) 80%, #0A0A0F 100%)',
        }} />

        {/* Property info over photo */}
        <div style={{ position: 'absolute', bottom: 28, left: 24, right: 24 }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(200,164,90,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
            Welcome back
          </p>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 300, color: '#F5F5F7', margin: '4px 0 2px', lineHeight: 1.15 }}>
            {site?.name ?? siteSlug}
          </h1>
          <p style={{ fontSize: '0.72rem', fontWeight: 200, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            {site?.address}{site?.city ? `, ${site.city}, ${site.state}` : ''}
          </p>
        </div>
      </div>

      {/* ── Module row label ─────────────────────────────────────────────── */}
      <div style={{ paddingLeft: 24, paddingTop: 28, paddingBottom: 12 }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(200,164,90,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Your Community
        </p>
      </div>

      {/* ── Horizontal scrolling icon dock ───────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 20,
          overflowX: 'auto',
          padding: '4px 24px 24px',
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {visibleModules.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', margin: 'auto' }}>
            No features enabled for this property.
          </p>
        ) : (
          visibleModules.map(m => (
            <div key={m} style={{ scrollSnapAlign: 'start' }}>
              <ModuleIcon moduleKey={m} color={MODULE_COLORS[m]} />
            </div>
          ))
        )}
      </div>

      {/* ── Quick access tiles ───────────────────────────────────────────── */}
      {features.gates || features.doors ? (
        <div style={{ padding: '0 24px 24px' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(200,164,90,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 14px' }}>
            Quick Access
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            {features.gates && (
              <button
                style={{
                  flex: 1,
                  padding: '16px 12px',
                  borderRadius: 16,
                  background: 'rgba(200,164,90,0.08)',
                  border: '1px solid rgba(200,164,90,0.22)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: '#C8A45A',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,164,90,0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(200,164,90,0.08)')}
              >
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICON_PATHS.gates} />
                </svg>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Open Gate</span>
              </button>
            )}
            {features.doors && (
              <button
                style={{
                  flex: 1,
                  padding: '16px 12px',
                  borderRadius: 16,
                  background: 'rgba(16,16,22,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,16,22,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,16,22,0.6)')}
              >
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICON_PATHS.doors} />
                </svg>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Doors</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(200,164,90,0.4)' }} />
        <span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Secured by GateGuard
        </span>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(200,164,90,0.4)' }} />
      </div>
    </div>
  )
}
