'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PhoneOff, CheckCircle, XCircle } from 'lucide-react'

type CallPhase =
  | 'initiating'
  | 'ringing'
  | 'answered'
  | 'gate_opened'
  | 'denied'
  | 'no_answer'
  | 'cancelled'
  | 'failed'

export default function CallPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>
}) {
  const { siteSlug } = use(params)
  const searchParams  = useSearchParams()
  const router        = useRouter()

  const residentId   = searchParams.get('resident') ?? ''
  const residentName = searchParams.get('name')     ?? 'Resident'
  const residentUnit = searchParams.get('unit')     ?? ''

  const [phase, setPhase]     = useState<CallPhase>('initiating')
  const [callSid, setCallSid] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearIntervals = () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ── Initiate call on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!residentId) {
      router.back()
      return
    }

    let cancelled = false

    async function start() {
      try {
        const res = await fetch('/api/call/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteSlug, residentId, entryType: 'directory' }),
        })
        const data = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setPhase('failed')
          return
        }

        setCallSid(data.callSid)
        setEventId(data.eventId)
        setPhase('ringing')
      } catch {
        if (!cancelled) setPhase('failed')
      }
    }

    start()
    return () => { cancelled = true }
  }, [residentId, siteSlug, router])

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'ringing' || phase === 'answered') {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // ── Poll for outcome ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId || phase === 'initiating') return
    if (['gate_opened', 'denied', 'no_answer', 'cancelled', 'failed'].includes(phase)) return

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/call/status?eventId=${eventId}`)
        const data = await res.json()

        const outcome: CallPhase = data.outcome

        if (outcome === 'gate_opened') {
          clearIntervals()
          setPhase('gate_opened')
          // Auto-navigate back after 4 seconds
          setTimeout(() => router.replace(`/${siteSlug}`), 4000)
        } else if (outcome === 'denied') {
          clearIntervals()
          setPhase('denied')
          setTimeout(() => router.replace(`/${siteSlug}`), 3000)
        } else if (outcome === 'no_answer') {
          clearIntervals()
          setPhase('no_answer')
          setTimeout(() => router.replace(`/${siteSlug}`), 3000)
        } else if (outcome === 'answered') {
          setPhase('answered')
        } else if (outcome === 'ringing') {
          setPhase('ringing')
        }
      } catch {
        // ignore poll errors
      }
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [eventId, phase, siteSlug, router])

  // ── Cancel / end call ─────────────────────────────────────────────────────
  const handleEndCall = async () => {
    clearIntervals()
    setPhase('cancelled')

    if (callSid || eventId) {
      await fetch('/api/call/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, eventId }),
      }).catch(() => {})
    }

    setTimeout(() => router.replace(`/${siteSlug}`), 1200)
  }

  // ── Timer format ──────────────────────────────────────────────────────────
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Render ────────────────────────────────────────────────────────────────
  const isTerminal = ['gate_opened', 'denied', 'no_answer', 'cancelled', 'failed'].includes(phase)

  return (
    <div className="gc-shell">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">

        {/* ── Resident info ──────────────────────────────────── */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--color-gc-text-muted)' }}
          >
            Unit {residentUnit}
          </p>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-gc-text)' }}
          >
            {residentName}
          </h1>
        </div>

        {/* ── Status badge ──────────────────────────────────── */}
        <StatusBadge phase={phase} />

        {/* ── Concentric rings / result icon ─────────────────── */}
        {!isTerminal ? (
          <div className="gc-call-rings">
            <div className="gc-call-ring gc-call-ring-1" />
            <div className="gc-call-ring gc-call-ring-2" />
            <div className="gc-call-ring gc-call-ring-3" />
            <div className="gc-call-center">
              <PhoneRinging phase={phase} />
            </div>
          </div>
        ) : (
          <ResultIcon phase={phase} />
        )}

        {/* ── Timer ─────────────────────────────────────────── */}
        {(phase === 'ringing' || phase === 'answered') && (
          <span
            className="text-xl font-mono tabular-nums"
            style={{ color: 'var(--color-gc-text-secondary)' }}
          >
            {formatTime(elapsed)}
          </span>
        )}

        {/* ── Phase copy ────────────────────────────────────── */}
        <PhaseCopy phase={phase} />

        {/* ── End call button ───────────────────────────────── */}
        {!isTerminal && (
          <button
            onClick={handleEndCall}
            className="gc-btn-danger mt-2"
            style={{ maxWidth: 220 }}
          >
            <PhoneOff size={18} />
            End Call
          </button>
        )}

      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ phase }: { phase: CallPhase }) {
  const map: Record<CallPhase, { cls: string; label: string }> = {
    initiating: { cls: 'gc-badge-calling', label: 'Connecting…' },
    ringing:    { cls: 'gc-badge-ringing', label: 'Ringing' },
    answered:   { cls: 'gc-badge-calling', label: 'Connected' },
    gate_opened:{ cls: 'gc-badge-open',   label: 'Gate Opening' },
    denied:     { cls: 'gc-badge-denied', label: 'Access Denied' },
    no_answer:  { cls: 'gc-badge-denied', label: 'No Answer' },
    cancelled:  { cls: 'gc-badge-denied', label: 'Cancelled' },
    failed:     { cls: 'gc-badge-denied', label: 'Call Failed' },
  }
  const { cls, label } = map[phase]
  return (
    <div className={`gc-badge ${cls}`}>
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{
          background: 'currentColor',
          animation: phase === 'ringing' ? 'gc-ring-pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </div>
  )
}

function PhoneRinging({ phase }: { phase: CallPhase }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {phase === 'answered' ? (
        // Mic icon when connected
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
        </>
      ) : (
        // Phone icon when ringing
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.85 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.96 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      )}
    </svg>
  )
}

function ResultIcon({ phase }: { phase: CallPhase }) {
  if (phase === 'gate_opened') {
    return (
      <div className="gc-success-ring">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 80, height: 80,
            background: 'rgba(16,185,129,0.15)',
            border: '2px solid rgba(16,185,129,0.4)',
          }}
        >
          <CheckCircle size={40} color="#10B981" />
        </div>
      </div>
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: 80, height: 80,
        background: 'rgba(239,68,68,0.12)',
        border: '2px solid rgba(239,68,68,0.3)',
      }}
    >
      <XCircle size={40} color="#EF4444" />
    </div>
  )
}

function PhaseCopy({ phase }: { phase: CallPhase }) {
  const copy: Record<CallPhase, string> = {
    initiating:  'Connecting your call…',
    ringing:     "Calling the resident's phone.",
    answered:    'Resident is on the line. Waiting for entry decision.',
    gate_opened: 'Gate is opening. Please proceed.',
    denied:      'The resident has declined access.',
    no_answer:   'The resident did not answer.',
    cancelled:   'Call cancelled.',
    failed:      'Call could not be completed.',
  }
  return (
    <p
      className="text-sm max-w-xs"
      style={{ color: 'var(--color-gc-text-secondary)' }}
    >
      {copy[phase]}
    </p>
  )
}
