'use client'

import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import type {
  MoveInContext, MemberSelection, AddOnKind, VehicleDraft, PromoResult,
} from '@/lib/types'

/**
 * Move-in selections, held in the layout so they survive navigation between
 * steps. In memory and sessionStorage only — this is the UX phase, nothing
 * persists server-side and nothing is submitted. When the backend lands, this
 * provider is where the mutations get wired; the screens don't change.
 */

export const EMPTY_VEHICLE: VehicleDraft = {
  plate: '', state: '', make: '', model: '', color: '',
}

export interface MoveInState {
  /** Confirmed on screen 1. Name, unit and dates are read-only — they come
   *  from the roster and are changed at the leasing office, not here. */
  mobile: string
  emailConfirmed: boolean

  /** Per person: pass, add-on, vehicle. Keyed by household member id. */
  members: Record<string, MemberSelection>

  /** Listed in the callbox directory. Never affects access, either way. */
  directoryListed: boolean
  /** Which number rings when a guest calls. The name is the property's. */
  directoryPhone: string

  /** Sellable offers the resident switched on. */
  services: string[]
  /** Included activations and quote requests — asked for, but not bought. */
  requested: string[]

  /** What the resident typed into the code box, and what came back. */
  promoInput: string
  promo: PromoResult | null

  /**
   * Furthest step actually reached, so they can move back and forward across
   * what they've done without jumping ahead into a screen that depends on
   * answers they haven't given yet.
   */
  furthest: number
}

const Ctx = createContext<{
  ctx: MoveInContext
  s: MoveInState
  set: <K extends keyof MoveInState>(k: K, v: MoveInState[K]) => void
  /** Patch one household member's selection. */
  setMember: (id: string, patch: Partial<MemberSelection>) => void
} | null>(null)

export function MoveInProvider(
  { ctx, children }: { ctx: MoveInContext; children: ReactNode },
) {
  const storageKey = `movein:${ctx.property.slug}`

  const [s, setS] = useState<MoveInState>(() => {
    // The person who opened the link always gets a pass — they are why the
    // link exists. Anyone already active on the roster keeps theirs. Everyone
    // else starts off, because granting building access to another adult is a
    // decision, not a default.
    const members: Record<string, MemberSelection> = {}
    for (const m of ctx.resident.household) {
      members[m.id] = {
        pass: m.role === 'me' || m.alreadyActive,
        addOn: 'none',
        vehicle: null,
        noVehicle: false,
      }
    }

    return {
      mobile: ctx.resident.mobile ?? '',
      emailConfirmed: false,
      members,
      directoryListed: ctx.property.directory.mode === 'required'
        ? true
        : ctx.property.directory.defaultListed,
      directoryPhone: '',
      services: [],
      requested: [],
      promoInput: '',
      promo: null,
      furthest: 0,
    }
  })

  const set = <K extends keyof MoveInState>(k: K, v: MoveInState[K]) =>
    setS(prev => ({ ...prev, [k]: v }))

  const setMember = (id: string, patch: Partial<MemberSelection>) =>
    setS(prev => ({
      ...prev,
      members: {
        ...prev.members,
        [id]: { ...prev.members[id], ...patch },
      },
    }))

  /**
   * Survive a reload.
   *
   * Move-in happens on a phone, outdoors, on whatever signal the parking lot
   * has. A dropped connection or an accidental refresh should not mean typing
   * everything again — that is how a four-minute task becomes a call to the
   * leasing office.
   *
   * Read in an effect rather than in the state initialiser, so the server and
   * the first client render agree.
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

  return (
    <Ctx.Provider value={{ ctx, s, set, setMember }}>{children}</Ctx.Provider>
  )
}

export function useMoveIn() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMoveIn must be used inside MoveInProvider')
  return c
}

// ── Derived helpers, shared by the screens and the receipt ───────────────────

/** Everyone getting a pass, in roster order. */
export function passHolders(ctx: MoveInContext, s: MoveInState) {
  return ctx.resident.household.filter(m => s.members[m.id]?.pass)
}

/** What one add-on costs at this property. */
export function addOnPrice(ctx: MoveInContext, kind: AddOnKind): number {
  if (kind === 'none') return 0
  return ctx.credentials.find(c => c.kind === kind)?.priceCents ?? 0
}

/** A vehicle is finished when it can actually reach a gate: plate and state. */
export function vehicleComplete(v: VehicleDraft | null): boolean {
  return Boolean(v && v.plate.trim().length >= 2 && v.state.trim().length >= 2)
}

/** Touched but unfinished — worse than none, it reaches the gate half-formed. */
export function vehicleHalfDone(sel: MemberSelection | undefined): boolean {
  if (!sel || sel.noVehicle || !sel.vehicle) return false
  const v = sel.vehicle
  const touched = v.plate.trim() || v.state.trim() || v.make.trim() || v.model.trim()
  return Boolean(touched) && !vehicleComplete(v)
}
