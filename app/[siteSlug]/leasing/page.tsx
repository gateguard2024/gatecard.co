'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Building2, Phone, Clock, Mail } from 'lucide-react'

export default function LeasingPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const router = useRouter()
  const [calling, setCalling] = useState(false)

  const handleCall = async () => {
    setCalling(true)
    try {
      const res = await fetch('/api/call/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteSlug, entryType: 'leasing' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect')

      router.push(
        `/${siteSlug}/call?resident=${data.residentId ?? ''}&name=Leasing+Office&unit=Leasing`
      )
    } catch {
      setCalling(false)
    }
  }

  return (
    <div className="gc-shell">

      <header
        className="flex items-center gap-3 px-4 pt-8 pb-5"
        style={{ borderBottom: '1px solid var(--color-gc-border)' }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--color-gc-text-secondary)' }}
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Leasing Office
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Speak with a leasing agent
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">

        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 72, height: 72,
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            <Building2 size={34} color="#8B5CF6" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-gc-text)' }}>
              Leasing Office
            </h2>
            <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Connect directly with a leasing agent for tours, availability, and rental inquiries.
            </p>
          </div>
        </div>

        {/* Info cards */}
        <div className="flex flex-col gap-2.5">
          <div
            className="gc-card flex items-center gap-3 p-4"
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 36, height: 36,
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <Clock size={17} color="#8B5CF6" />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-gc-text)' }}>
                Office Hours
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-gc-text-muted)' }}>
                Mon – Fri  9:00 AM – 6:00 PM
              </p>
              <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
                Sat  10:00 AM – 4:00 PM
              </p>
            </div>
          </div>

          <div
            className="gc-card flex items-center gap-3 p-4"
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 36, height: 36,
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <Mail size={17} color="#8B5CF6" />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-gc-text)' }}>
                After Hours
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-gc-text-muted)' }}>
                Leave a message and we'll call back next business day.
              </p>
            </div>
          </div>
        </div>

        {/* Call button */}
        <div className="mt-auto pt-4">
          <button
            className="gc-btn-primary w-full"
            style={{
              background: calling
                ? 'rgba(139,92,246,0.5)'
                : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              borderColor: 'rgba(139,92,246,0.4)',
            }}
            onClick={handleCall}
            disabled={calling}
          >
            <Phone size={18} />
            {calling ? 'Connecting…' : 'Call Leasing Office'}
          </button>

          <p
            className="text-center text-xs mt-3"
            style={{ color: 'var(--color-gc-text-muted)' }}
          >
            Your call will be connected through the intercom.
          </p>
        </div>

      </main>
    </div>
  )
}
