'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
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
  services: string[]
  cart: Record<string, number>
  /** Listed in the callbox directory. Never affects access, either way. */
  directoryListed: boolean
  directoryFormat: DirectoryNameFormat
}

const EMPTY: MoveInState = {
  mobile: '',
  credential: 'phone',
  extraCredentials: [],
  parkingTierId: '',
  vehicle: { plate: '', state: '', make: '', model: '', color: '' },
  services: [],
  cart: {},
  directoryListed: true,
  directoryFormat: 'last_initial',
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
  return <Ctx.Provider value={{ ctx, s, set }}>{children}</Ctx.Provider>
}

export function useMoveIn() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMoveIn must be used inside MoveInProvider')
  return c
}
