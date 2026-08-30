'use client'

import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import type {
  CredentialKind, VehicleDraft, MoveInContext, DirectoryNameFormat,
} from '@/lib/types'

/**
 * Move-in selections, held in the layout so they survive navigation between
 * steps. Deliberately in memory only — this is the UX phase, nothing persists
 * and nothing is submitted. When the backend lands, this provider is where the
 * mutations get wired; the screens don't change.
 */
export interface MoveInState {
  mobile: string
  credential: CredentialKind
  extraCredentials: CredentialKind[]
  parkingTierId: string
  vehicle: VehicleDraft
  /** Sellable offers the resident ticked. */
  services: string[]
  /**
   * Offers driven by a button rather than a tick — an included service being
   * switched on, or a quote being asked for. Neither is a purchase, so they
   * are kept apart from `services` and never reach a total.
   */
  requested: string[]
  cart: Record<string, number>
  /** Listed in the callbox directory. Never affects access, either way. */
  directoryListed: boolean
  directoryFormat: DirectoryNameFormat
  /**
   * Furthest step the resident has actually reached, so they can move back and
   * forward across what they've done without being able to jump ahead into a
   * screen that depends on answers they haven't given yet.
   */
  furthest: number
}

const EMPTY: MoveInState = {
  mobile: '',
  credential: 'phone',
  extraCredentials: [],
  parkingTierId: '',
  vehicle: { plate: '', state: '', make: '', model: '', color: '' },
  services: [],
  requested: [],
  cart: {},
  directoryListed: true,
  directoryFormat: 'last_initial',
  furthest: 0,
}

const Ctx = createContext<{
  /** Property, resident and catalogs — loaded on the server, mock or real. */
  ctx: MoveInContext
  s: MoveInState
  set: <K extends keyof MoveInState>(k: K, v: MoveInState[K]) => void
} | null>(null)

export function MoveInProvider(
  { ctx, children }: { ctx: MoveInContext; children: ReactNode },
) {
  const storageKey = `movein:${ctx.property.slug}`

  const [s, setS] = useState<MoveInState>(() => ({
    ...EMPTY,
    // Default to whatever the property marks as included.
    parkingTierId: ctx.parkingTiers.find(t => t.included)?.id ?? '',
    credential: ctx.credentials.find(c => c.isDefault)?.kind ?? 'phone',
    // A property that mandates listing overrides the default; otherwise the
    // property's own default decides where the toggle starts.
    directoryListed: ctx.property.directory.mode === 'required'
      ? true
      : ctx.property.directory.defaultListed,
    directoryFormat: ctx.property.directory.formats[0] ?? 'last_initial',
  }))
  const set = <K extends keyof MoveInState>(k: K, v: MoveInState[K]) =>
    setS(prev => ({ ...prev, [k]: v }))

  /**
   * Survive a reload.
   *
   * Move-in happens on a phone, outdoors, on whatever signal the parking lot
   * has. A dropped connection or an accidental refresh should not mean typing
   * everything again — that is how a four-minute task becomes a call to the
   * leasing office.
   *
   * Read in an effect rather than in the state initialiser, so the server and
   * the first client render agree. Session-scoped and best-effort: a private
   * window or blocked storage just means the flow behaves as it did before.
   */
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) setS(prev => ({ ...prev, ...JSON.parse(raw) as Partial<MoveInState> }))
    } catch { /* storage unavailable — carry on without it */ }
    loaded.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(s))
    } catch { /* quota or private mode — not worth interrupting a move-in for */ }
  }, [s, storageKey])

  return <Ctx.Provider value={{ ctx, s, set }}>{children}</Ctx.Provider>
}

export function useMoveIn() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMoveIn must be used inside MoveInProvider')
  return c
}
