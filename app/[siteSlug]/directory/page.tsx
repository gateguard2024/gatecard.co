'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Phone, User } from 'lucide-react'

interface Resident {
  id: string
  unit_number: string
  first_name: string
  last_name: string
  display_name: string
}

export default function DirectoryPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const router = useRouter()

  const [query, setQuery]         = useState('')
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchResidents = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const url = `/api/residents?siteSlug=${siteSlug}&q=${encodeURIComponent(q)}`
        const res = await fetch(url)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load')
        setResidents(data.residents)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load directory')
      } finally {
        setLoading(false)
      }
    },
    [siteSlug]
  )

  // Initial load
  useEffect(() => { fetchResidents('') }, [fetchResidents])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchResidents(query), 300)
    return () => clearTimeout(t)
  }, [query, fetchResidents])

  const handleCall = (resident: Resident) => {
    const params = new URLSearchParams({
      resident: resident.id,
      unit: resident.unit_number,
      name: resident.display_name,
    })
    router.push(`/${siteSlug}/call?${params}`)
  }

  return (
    <div className="gc-shell">

      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 pt-8 pb-4"
        style={{ borderBottom: '1px solid var(--color-gc-border)' }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-xl p-2 -ml-2 transition-colors"
          style={{ color: 'var(--color-gc-text-secondary)' }}
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-gc-text)' }}>
            Resident Directory
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-gc-text-muted)' }}>
            Search by name or unit number
          </p>
        </div>
      </header>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-gc-text-muted)' }}
          />
          <input
            type="text"
            className="gc-input"
            placeholder="Unit 101 or Smith..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-gc-blue)', borderTopColor: 'transparent' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-gc-text-muted)' }}>
              Loading directory…
            </span>
          </div>
        )}

        {error && (
          <div
            className="mx-0 my-3 p-4 rounded-xl text-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: '#FCA5A5',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && residents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <User size={36} style={{ color: 'var(--color-gc-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-gc-text-secondary)' }}>
              {query ? `No results for "${query}"` : 'No residents found'}
            </p>
          </div>
        )}

        {!loading && !error && residents.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--color-gc-border)' }}
          >
            {residents.map((resident) => (
              <button
                key={resident.id}
                className="gc-resident-row w-full text-left"
                onClick={() => handleCall(resident)}
              >
                {/* Unit badge */}
                <div
                  className="flex items-center justify-center rounded-xl shrink-0 font-semibold text-sm tabular-nums"
                  style={{
                    width: 44, height: 44,
                    background: 'var(--color-gc-raised)',
                    color: 'var(--color-gc-blue-light)',
                    border: '1px solid var(--color-gc-border)',
                  }}
                >
                  {resident.unit_number}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-gc-text)' }}
                  >
                    {resident.display_name}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--color-gc-text-muted)' }}
                  >
                    Unit {resident.unit_number}
                  </div>
                </div>

                {/* Call icon */}
                <Phone
                  size={16}
                  style={{ color: 'var(--color-gc-blue)', opacity: 0.7 }}
                />
              </button>
            ))}
          </div>
        )}
      </main>

    </div>
  )
}
