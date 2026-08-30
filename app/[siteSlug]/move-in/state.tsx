'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CredentialKind, VehicleDraft } from '@/lib/types'

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
  services: string[]
  cart: Record<string, number>
}

const EMPTY: MoveInState = {
  mobile: '',
  credential: 'phone',
  extraCredentials: [],
  parkingTierId: '',
  vehicle: { plate: '', state: '', make: '', model: '', color: '' },
  services: [],
  cart: {},
}

const Ctx = createContext<{
  s: MoveInState
  set: <K extends keyof MoveInState>(k: K, v: MoveInState[K]) => void
} | null>(null)

export function MoveInProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<MoveInState>(EMPTY)
  const set = <K extends keyof MoveInState>(k: K, v: MoveInState[K]) =>
    setS(prev => ({ ...prev, [k]: v }))
  return <Ctx.Provider value={{ s, set }}>{children}</Ctx.Provider>
}

export function useMoveIn() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMoveIn must be used inside MoveInProvider')
  return c
}
