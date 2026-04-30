'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Phone, Building2 } from 'lucide-react'

export default function VisitPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const router = useRouter()

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
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Visitors &amp; Leasing
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Choose an option below
          </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-4 py-6">

        {/* Call a Resident */}
        <button
          className="gc-main-tile"
          onClick={() => router.push(`/${siteSlug}/directory`)}
          aria-label="Call a resident"
        >
          <div
            className="flex items-center justify-center rounded-2xl shrink-0"
            style={{
              width: 60, height: 60,
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.25)',
            }}
          >
            <Phone size={26} color="#3B82F6" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
              Call a Resident
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Search the directory and ring a unit.
            </div>
          </div>
          <ChevronRightIcon />
        </button>

        {/* Leasing Office */}
        <button
          className="gc-main-tile"
          onClick={() => router.push(`/${siteSlug}/leasing`)}
          aria-label="Speak with leasing"
        >
          <div
            className="flex items-center justify-center rounded-2xl shrink-0"
            style={{
              width: 60, height: 60,
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.25)',
            }}
          >
            <Building2 size={26} color="#8B5CF6" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
              Leasing Office
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-gc-text-secondary)' }}>
              Schedule a tour or speak with leasing.
            </div>
          </div>
          <ChevronRightIcon />
        </button>

      </main>

    </div>
  )
}

function ChevronRightIcon() {
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
