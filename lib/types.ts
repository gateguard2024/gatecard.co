// ─────────────────────────────────────────────────────────────────────────────
// GateCard Move-In Portal — data contracts
//
// These shapes are what the backend must satisfy. The UX reads them from
// lib/mock/ today; wiring is a swap of the data source, not a rewrite.
// ─────────────────────────────────────────────────────────────────────────────

/** A property. The resident's relationship is with this, not with Gate Guard. */
export interface Property {
  slug: string
  name: string
  addressLine: string
  cityState: string
  /** Per-property accent. Overrides the default gold. Any CSS color. */
  accent: string
  /** Optional wordmark shown in the header instead of the name. */
  logoUrl: string | null
  leasingPhone: string
  leasingHours: string
  /** Shown on 06. Where support goes — the property, never Gate Guard. */
  supportEmail: string
}

/** Pre-filled from the Brivo roster. Resident edits at most the mobile number. */
export interface ResidentIdentity {
  firstName: string
  lastName: string
  unitNumber: string
  moveInDate: string // ISO
  email: string | null
  mobile: string | null
  /** Other people on the lease. Each gets their own link — never a shared session. */
  householdMembers: { firstName: string; lastName: string; invited: boolean }[]
}

// ── Screen 02 — access credentials ───────────────────────────────────────────

export type CredentialKind = 'phone' | 'fob' | 'keytag'

export interface CredentialOption {
  kind: CredentialKind
  label: string
  blurb: string
  /** Cents. 0 = included. Anything > 0 is a card charge, never the mandatory rail. */
  priceCents: number
  /** Exactly one option is the default; it must be free and instant. */
  isDefault: boolean
  /** Physical items ship blank and inert, enrolled on first tap (D5). */
  isPhysical: boolean
  deliveryNote: string | null
}

// ── Screen 03 — parking ──────────────────────────────────────────────────────

export interface ParkingTier {
  id: string
  label: string
  blurb: string
  /** Cents/month. 0 = included with the lease. */
  monthlyCents: number
  /** Real inventory. 0 means show it, disabled, with a waitlist affordance. */
  spacesAvailable: number
  included: boolean
}

export interface VehicleDraft {
  plate: string
  state: string
  make: string
  model: string
  color: string
}

// ── Screen 04 — services (offer engine output) ───────────────────────────────

/**
 * How a service presents at THIS property. The offer engine (D7) decides this
 * per property — never hardcoded, never a conditional in the UI.
 *
 *  sellable   — orderable here; commission tracked
 *  included   — already covered (e.g. bulk internet ROE). Card becomes an
 *               activation helper, not a purchase.
 *  quote      — configurator flow, deposit + subscription (security system)
 *  unavailable— not offered here. Not rendered at all.
 */
export type OfferMode = 'sellable' | 'included' | 'quote' | 'unavailable'

export interface ServiceOffer {
  id: string
  name: string
  provider: string
  category: 'internet' | 'tv' | 'security' | 'insurance' | 'other'
  blurb: string
  mode: OfferMode
  /** Cents/month where meaningful. Null for quote flows. */
  monthlyCents: number | null
  /** Copy for the primary button, mode-dependent. */
  ctaLabel: string
  /** Shown when mode === 'included' — why it's already covered. */
  includedReason: string | null
  /** True where the lease requires it — drives the day-10 nudge. */
  leaseRequired: boolean
}

// ── Screen 05 — store ────────────────────────────────────────────────────────

/**
 * Merch and credential items sit in one grid. The resident cannot tell them
 * apart and shouldn't — but the order handler must (D5).
 */
export interface StoreProduct {
  id: string
  name: string
  blurb: string
  priceCents: number
  imageEmoji: string
  /** 'merch' routes to the dropship supplier; 'credential' routes to Brivo enrollment. */
  fulfilment: 'merch' | 'credential'
  inStock: boolean
}

// ── Screen 06 — confirmation ─────────────────────────────────────────────────

/** Grouped by STATE, not by product. This is the whole point of the screen. */
export type ItemState = 'working_now' | 'on_the_way' | 'scheduled'

export interface ConfirmationItem {
  id: string
  label: string
  detail: string
  state: ItemState
  /** Which rail this sits on. Rendered in separate blocks, never interleaved. */
  rail: 'included' | 'card'
}

// ── The whole move-in session ────────────────────────────────────────────────

export interface MoveInContext {
  property: Property
  resident: ResidentIdentity
  credentials: CredentialOption[]
  parkingTiers: ParkingTier[]
  services: ServiceOffer[]
  store: StoreProduct[]
}
