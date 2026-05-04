'use client'

import { useState } from 'react'
import {
  Building2, Globe, MapPin, Phone, Key, Wifi, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, ArrowRight, Lock,
} from 'lucide-react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

const INITIAL = {
  name: '', slug: '', address: '', city: '', state: '',
  leasing_phone: '', soc_phone: '',
  brivo_site_id: '', een_camera_id: '',
  unifi_controller_url: '', unifi_local_username: '',
  unifi_local_password: '', unifi_template_id: '',
}

export default function SetupSitePage() {
  const [form, setForm]       = useState(INITIAL)
  const [state, setState]     = useState<FormState>('idle')
  const [error, setError]     = useState('')
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null)
  const [showUnifi, setShowUnifi] = useState(false)

  const set = (k: keyof typeof INITIAL) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({ ...f, name, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('submitting')
    setError('')

    try {
      const res = await fetch('/api/sites/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setCreated(data.site)
      setState('success')
    } catch (err: unknown) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (state === 'success' && created) {
    return (
      <div className="gc-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={36} color="var(--gc-emerald)" />
        </div>

        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gc-text)', marginBottom: 8 }}>
            {created.name} is live
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gc-text-secondary)' }}>
            Site created and saved to Supabase.
          </p>
        </div>

        <div style={{ width: '100%', background: 'var(--gc-raised)', border: '1px solid var(--gc-border)', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: 12, color: 'var(--gc-text-secondary)', marginBottom: 8 }}>Next steps on the Pi</p>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--gc-gold)', lineHeight: 1.8 }}>
            <div># 1. Fill in /etc/gatecard-agent.env</div>
            <div>SITE_SLUG={created.slug}</div>
            <div style={{ marginTop: 8 }}># 2. Dry run</div>
            <div>sudo -u gatecard node /opt/gatecard-agent/sync-agent.js --dry-run</div>
            <div style={{ marginTop: 8 }}># 3. First sync</div>
            <div>sudo systemctl start gatecard-sync.service</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <a
            href={`/${created.slug}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.75rem', background: 'var(--gc-gold)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#0A0A0F', textDecoration: 'none' }}
          >
            View site <ArrowRight size={14} />
          </a>
          <button
            onClick={() => { setForm(INITIAL); setState('idle'); setCreated(null) }}
            style={{ flex: 1, padding: '0.75rem', background: 'var(--gc-raised)', border: '1px solid var(--gc-border)', borderRadius: 12, fontSize: 13, color: 'var(--gc-text-secondary)', cursor: 'pointer' }}
          >
            Add another site
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gc-shell">

      {/* Header */}
      <header style={{ padding: '2rem 1.25rem 1.25rem', borderBottom: '1px solid var(--gc-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src="/logo.png" alt="GateCard" style={{ height: 36, width: 'auto' }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gc-text)', lineHeight: 1.3 }}>
          Set up a new site
        </h1>
        <p style={{ fontSize: 13, color: 'var(--gc-text-secondary)', marginTop: 4 }}>
          Creates or updates the site row in Supabase. Safe to re-run.
        </p>
      </header>

      <main style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Site basics ──────────────────────────────────── */}
          <Section label="Site basics" icon={Building2}>
            <Field
              label="Property name"
              placeholder="East Ponce Village"
              value={form.name}
              onChange={handleNameChange}
              required
            />
            <Field
              label="URL slug"
              placeholder="east-ponce"
              value={form.slug}
              onChange={set('slug')}
              required
              hint="Used in gatecard.co/[slug] — auto-filled from name"
            />
            <Field
              label="Street address"
              placeholder="123 Ponce de Leon Ave NE"
              value={form.address}
              onChange={set('address')}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <Field
                label="City"
                placeholder="Atlanta"
                value={form.city}
                onChange={set('city')}
                required
              />
              <Field
                label="State"
                placeholder="GA"
                value={form.state}
                onChange={set('state')}
                style={{ width: 64 }}
                maxLength={2}
                required
              />
            </div>
          </Section>

          {/* ── Phone numbers ─────────────────────────────── */}
          <Section label="Phone numbers" icon={Phone}>
            <Field
              label="Leasing office"
              placeholder="+14045550100"
              value={form.leasing_phone}
              onChange={set('leasing_phone')}
              type="tel"
              hint="E.164 format"
            />
            <Field
              label="Security ops center"
              placeholder="+14045550199"
              value={form.soc_phone}
              onChange={set('soc_phone')}
              type="tel"
              hint="E.164 format"
            />
          </Section>

          {/* ── Integrations ─────────────────────────────── */}
          <Section label="Integrations" icon={Globe}>
            <Field
              label="Brivo site ID"
              placeholder="brivo-site-id"
              value={form.brivo_site_id}
              onChange={set('brivo_site_id')}
              hint="From Brivo dashboard — required for resident sync"
            />
            <Field
              label="Eagle Eye camera ID"
              placeholder="een-camera-id"
              value={form.een_camera_id}
              onChange={set('een_camera_id')}
              hint="Camera at the main entry gate"
            />
          </Section>

          {/* ── UniFi intercom (tier 2) ───────────────────── */}
          <div style={{ border: '1px solid var(--gc-gold-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--gc-gold-dim)' }}>
            <button
              type="button"
              onClick={() => setShowUnifi(v => !v)}
              style={{ width: '100%', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <Wifi size={15} style={{ color: 'var(--gc-gold)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--gc-gold)' }}>
                UniFi intercom — tier 2
              </span>
              <span style={{ fontSize: 11, color: 'var(--gc-text-secondary)', marginRight: 6 }}>optional</span>
              {showUnifi
                ? <ChevronUp size={14} style={{ color: 'var(--gc-text-secondary)' }} />
                : <ChevronDown size={14} style={{ color: 'var(--gc-text-secondary)' }} />
              }
            </button>

            {showUnifi && (
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--gc-gold-border)' }}>
                <p style={{ fontSize: 12, color: 'var(--gc-text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
                  Required for Pi agent to sync resident call list to the intercom directory.
                </p>
                <Field
                  label="Controller URL"
                  placeholder="https://192.168.1.1"
                  value={form.unifi_controller_url}
                  onChange={set('unifi_controller_url')}
                  hint="Local LAN IP of the UniFi Access controller"
                />
                <Field
                  label="Local admin username"
                  placeholder="gatecard-sync"
                  value={form.unifi_local_username}
                  onChange={set('unifi_local_username')}
                  hint="Created in UniFi OS → Admins → Local Access Only"
                />
                <Field
                  label="Local admin password"
                  placeholder="••••••••••••"
                  value={form.unifi_local_password}
                  onChange={set('unifi_local_password')}
                  type="password"
                  icon={Lock}
                />
                <Field
                  label="Template ID"
                  placeholder="4533a662-fef8-4e4c-af6d-9a0a1cebc94c"
                  value={form.unifi_template_id}
                  onChange={set('unifi_template_id')}
                  hint='Find it: open browser console on controller → fetch("/proxy/access/api/v2/templates").then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))'
                />
              </div>
            )}
          </div>

          {/* Error */}
          {state === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
              <AlertCircle size={14} style={{ color: 'var(--gc-red)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--gc-red)' }}>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="gc-btn-primary"
            style={{ marginTop: 4 }}
          >
            {state === 'submitting' ? 'Saving…' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Save site <ArrowRight size={15} />
              </span>
            )}
          </button>

          <p style={{ fontSize: 11, color: 'var(--gc-text-muted)', textAlign: 'center' }}>
            Updates existing site if slug already exists.
          </p>

        </form>
      </main>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', borderTop: '1px solid var(--gc-border)' }}>
        <span style={{ fontSize: 11, color: 'var(--gc-text-muted)' }}>
          © 2026 Gate Guard, LLC
        </span>
      </footer>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  label, icon: Icon, children,
}: {
  label: string
  icon: React.ComponentType<{ size: number; style: React.CSSProperties }>
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} style={{ color: 'var(--gc-text-muted)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function Field({
  label, placeholder, value, onChange, type = 'text',
  hint, required, style: extraStyle, maxLength, icon: Icon,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  hint?: string
  required?: boolean
  style?: React.CSSProperties
  maxLength?: number
  icon?: React.ComponentType<{ size: number; style: React.CSSProperties }>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...extraStyle }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gc-text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--gc-red)', marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon
            size={14}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gc-text-muted)', pointerEvents: 'none' }}
          />
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          maxLength={maxLength}
          className="gc-input"
          style={{ width: '100%', paddingLeft: Icon ? '2.25rem' : undefined }}
        />
      </div>
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--gc-text-muted)', lineHeight: 1.5 }}>{hint}</p>
      )}
    </div>
  )
}
