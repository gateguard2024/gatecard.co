'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, AlertTriangle, Phone, ShieldAlert, Flame } from 'lucide-react'

export default function EmergencyPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [calling, setCalling] = useState(false)

  const handleSOC = async () => {
    setCalling(true)
    try {
      const res = await fetch('/api/call/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteSlug, entryType: 'emergency' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')

      router.push(
        `/${siteSlug}/call?resident=${data.residentId ?? ''}&name=Security+Operations&unit=SOC`
      )
    } catch {
      setCalling(false)
    }
  }

  return (
    <div className="gc-shell">

      <header
        className="flex items-center gap-3 px-4 pt-8 pb-5"
        style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--color-gc-text-secondary)' }}
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#FCA5A5' }}>
            Emergency
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Urgent assistance options
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-4">

        {/* Warning banner */}
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <AlertTriangle size={18} color="#EF4444" className="shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: '#FCA5A5' }}>
            Use only for genuine emergencies. False alarms may result in fines and service interruptions.
          </p>
        </div>

        {/* 911 */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2.5"
            style={{ color: 'var(--color-gc-text-muted)' }}
          >
            Life-Threatening Emergency
          </p>
          <a
            href="tel:911"
            className="flex items-center gap-3 p-4 rounded-2xl w-full"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 44, height: 44,
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <Flame size={20} color="#EF4444" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: '#FCA5A5' }}>
                Call 911
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-gc-text-muted)' }}>
                Fire · Medical · Police
              </p>
            </div>
            <Phone size={17} color="#EF4444" />
          </a>
        </div>

        {/* Security Operations Center */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2.5"
            style={{ color: 'var(--color-gc-text-muted)' }}
          >
            Property Security
          </p>

          {!confirming ? (
            <button
              className="flex items-center gap-3 p-4 rounded-2xl w-full text-left"
              style={{
                background: 'var(--color-gc-surface)',
                border: '1px solid var(--color-gc-border)',
              }}
              onClick={() => setConfirming(true)}
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 44, height: 44,
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}
              >
                <ShieldAlert size={20} color="#F59E0B" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-gc-text)' }}>
                  Security Operations Center
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-gc-text-muted)' }}>
                  Suspicious activity · Trespassing · Non-life-threatening
                </p>
              </div>
              <Phone size={16} style={{ color: 'var(--color-gc-text-muted)' }} />
            </button>
          ) : (
            <div
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#FCD34D' }}>
                Connect to Security Operations?
              </p>
              <p className="text-xs" style={{ color: 'var(--color-gc-text-secondary)' }}>
                This will connect you directly to the GateGuard Security Operations Center. Reserve for non-911 security concerns.
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 gc-btn-ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => setConfirming(false)}
                  disabled={calling}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 gc-btn-danger"
                  style={{
                    fontSize: 13,
                    background: 'rgba(245,158,11,0.2)',
                    borderColor: 'rgba(245,158,11,0.4)',
                    color: '#FCD34D',
                  }}
                  onClick={handleSOC}
                  disabled={calling}
                >
                  <Phone size={15} />
                  {calling ? 'Connecting…' : 'Connect Now'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Address reminder */}
        <div
          className="rounded-xl p-3 mt-auto"
          style={{
            background: 'var(--color-gc-raised)',
            border: '1px solid var(--color-gc-border)',
          }}
        >
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-gc-text-secondary)' }}>
            Your location
          </p>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Provide this address to emergency services if needed.
          </p>
          <p
            className="text-sm font-semibold mt-1.5 font-mono"
            style={{ color: 'var(--color-gc-text)' }}
            id="site-address"
          >
            — Loading address —
          </p>
        </div>

      </main>
    </div>
  )
}
