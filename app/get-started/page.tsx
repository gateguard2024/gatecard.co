'use client'

import { useState } from 'react'
import { CheckCircle2, Building2, Phone, Mail, User, ArrowRight, Shield, Camera, Zap } from 'lucide-react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function GetStartedPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', property_name: '', units: '', city: '',
  })
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('submitting')
    setError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Submission failed')
      setState('success')
    } catch {
      setState('error')
      setError('Something went wrong. Please try again.')
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  if (state === 'success') {
    return (
      <div className="gc-shell items-center justify-center px-6 text-center gap-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <CheckCircle2 size={40} color="var(--gc-emerald)" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--gc-text)' }}>
            You're on the list!
          </h1>
          <p className="text-sm mt-2 max-w-xs" style={{ color: 'var(--gc-text-secondary)' }}>
            We'll reach out within one business day to schedule your demo.
          </p>
        </div>
        <a
          href="https://gateguard.co"
          className="text-sm font-semibold"
          style={{ color: 'var(--gc-blue-light)' }}
        >
          Learn more at gateguard.co →
        </a>
      </div>
    )
  }

  return (
    <div className="gc-shell">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="px-5 pt-8 pb-6"
        style={{ borderBottom: '1px solid var(--gc-border)' }}
      >
        <div className="flex items-center gap-2.5 mb-5">
          <img src="/logo.png" alt="GateGuard" style={{ height: 40, width: 'auto' }} />
        </div>
        <h1 className="text-2xl font-bold leading-snug" style={{ color: 'var(--gc-text)' }}>
          Smarter access control<br />for your community.
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--gc-text-secondary)' }}>
          AI-powered video monitoring + gate access for multifamily properties. Starting at $15/month.
        </p>

        {/* Value props */}
        <div className="flex flex-col gap-2 mt-4">
          {[
            { icon: Shield,  text: 'Brivo-integrated gate control' },
            { icon: Camera,  text: 'Eagle Eye video on every entry' },
            { icon: Zap,     text: '5-minute setup, no hardware swap' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon size={14} style={{ color: 'var(--gc-blue-light)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--gc-text-secondary)' }}>{text}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <main className="flex-1 px-5 py-6">
        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--gc-text)' }}>
          Request a free demo
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          <Field icon={User}     placeholder="Your full name"       value={form.name}          onChange={set('name')}          required />
          <Field icon={Mail}     placeholder="Email address"        value={form.email}          onChange={set('email')}         type="email" required />
          <Field icon={Phone}    placeholder="Phone number"         value={form.phone}          onChange={set('phone')}         type="tel" />
          <Field icon={Building2} placeholder="Property name"       value={form.property_name} onChange={set('property_name')} required />

          <div className="grid grid-cols-2 gap-3">
            <Field placeholder="# of units"   value={form.units} onChange={set('units')} type="number" />
            <Field placeholder="City"         value={form.city}  onChange={set('city')} />
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: 'var(--gc-red)' }}>{error}</p>
          )}

          <button
            type="submit"
            className="gc-btn-primary mt-2"
            disabled={state === 'submitting'}
          >
            {state === 'submitting' ? 'Submitting…' : (
              <>Get My Free Demo <ArrowRight size={16} /></>
            )}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--gc-text-muted)' }}>
            No commitment. We'll reach out within 1 business day.
          </p>
        </form>
      </main>

      <footer
        className="flex items-center justify-center gap-1.5 px-5 py-4"
        style={{ borderTop: '1px solid var(--gc-border)' }}
      >
        <div className="gc-dot" />
        <span className="text-xs" style={{ color: 'var(--gc-text-muted)' }}>
          © 2026 Gate Guard, LLC · gateguard.co
        </span>
        <div className="gc-dot" />
      </footer>

    </div>
  )
}

function Field({
  icon: Icon, placeholder, value, onChange, type = 'text', required,
}: {
  icon?: React.ComponentType<{ size: number; style: React.CSSProperties }>
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={15}
          style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--gc-text-muted)',
            pointerEvents: 'none',
          }}
        />
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="gc-input"
        style={{ paddingLeft: Icon ? '2.25rem' : '1rem' }}
      />
    </div>
  )
}
