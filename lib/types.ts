// ─────────────────────────────────────────────────────────────────────────────
// GateCard Move-In Portal — data contracts
//
// These shapes are what the backend must satisfy. The UX reads them from
// lib/mock/ today; wiring is a swap of the data source, not a rewrite.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a resident appears in the digital callbox directory.
 *
 * This is a privacy control, so the default is a property decision rather than
 * ours. Some properties mandate listing because deliveries fail without it;
 * others let residents choose. A resident who is unlisted must still be
 * reachable some other way, or the setting quietly breaks their deliveries.
 */
export type DirectoryNameFormat = 'full' | 'last_initial' | 'unit_only'

export type DirectoryMode =
  | 'required'   // the property mandates listing; shown, explained, not editable
  | 'optional'   // the resident chooses
  | 'hidden'     // no directory at this property; the section never renders

export interface DirectoryPolicy {
  mode: DirectoryMode
  /** Which way the toggle starts when mode is 'optional'. */
  defaultListed: boolean
  /**
   * How the name appears. A PROPERTY setting, not a resident one — the roster
   * is the property's record and a resident renaming themselves at the callbox
   * defeats the point of it. The resident controls two things: whether they
   * appear at all, and which number rings.
   */
  format: DirectoryNameFormat
  /** Why it matters here — packages, gate staff, a guest at 11pm. */
  note: string | null
}

/**
 * What a credential opens.
 *
 * A phone key is not one switch. It is a set of access points, and the parking
 * and amenity fee unlocks some of them — not all of them.
 *
 *   pedestrian  the walk-in route a resident uses to reach their apartment
 *   vehicle     the gated lot: driving in
 *   amenity     pool, gym, clubhouse
 *   common      shared building doors, mail and package rooms
 *
 * This distinction is the whole legal footing of the program. Withholding a
 * parking permit from someone who has not paid for parking is ordinary
 * commerce. Withholding the way someone walks home is a self-help lockout, and
 * it is the landlord's remedy in any case, never a vendor's.
 */
export type AccessScope = 'pedestrian' | 'vehicle' | 'amenity' | 'common'

export interface AccessPolicy {
  /**
   * Granted the moment sign-up completes, paid or not, and NEVER withheld for
   * non-payment. Pedestrian access to the dwelling belongs here at every
   * property, always.
   */
  alwaysGranted: AccessScope[]
  /** Unlocked when the parking and amenity fee is paid in full. */
  feeUnlocks: AccessScope[]
}

/** Human labels, so the screens and the emails cannot drift apart. */
export const SCOPE_LABEL: Record<AccessScope, string> = {
  pedestrian: 'Pedestrian gate to your property',
  vehicle: 'Vehicle gate — driving in',
  amenity: 'Pool, gym and clubhouse',
  common: 'Building and package room doors',
}

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
  directory: DirectoryPolicy
  /** Which access points the fee unlocks, and which are never withheld. */
  access: AccessPolicy
  /** Null where the property charges nothing to park inside the gates. */
  parkingFee: ParkingFee | null
}

/** Pre-filled from the Brivo roster. Resident edits at most the mobile number. */
export interface ResidentIdentity {
  firstName: string
  lastName: string
  unitNumber: string
  moveInDate: string // ISO
  email: string | null
  mobile: string | null
  /**
   * Everyone on the lease, including the resident opening this link.
   *
   * A phone pass is granted per person, from one session. That is a deliberate
   * change from "everyone gets their own link": it is faster, and the household
   * is a single lease. It also means one adult provisions building access for
   * another, so the pass list is written to the audit trail with who granted
   * it — see AGENTS.md.
   */
  household: HouseholdMember[]

  /**
   * Lease term in months. Short terms are common — 3, 6 and 9-month leases,
   * corporate stays, sublets — and the fee has to behave sensibly for them
   * rather than assuming twelve.
   */
  leaseTermMonths: number | null
  leaseEndDate: string | null


  /** The community-store welcome code. Null where the property has no store. */
  storeCode: StoreCode | null
}

export type HouseholdRole = 'me' | 'leaseholder' | 'occupant'

export interface HouseholdMember {
  id: string
  firstName: string
  lastName: string
  role: HouseholdRole
  /** Optional headshot. Falls back to initials. */
  avatarUrl: string | null
  /** True where the roster already shows them with access. */
  alreadyActive: boolean
}

/**
 * A physical backup credential, chosen per person.
 *
 * Either/or, one per person with a pass: a credential is enrolled against a
 * named human in Brivo, and a second one in the same pocket is a spare key to
 * the community that belongs to nobody in particular.
 */
export type AddOnKind = 'none' | 'fob' | 'keytag'

/** What one person on the lease ends up with. */
export interface MemberSelection {
  pass: boolean
  addOn: AddOnKind
  /** Null where they told us they have no vehicle. */
  vehicle: VehicleDraft | null
  noVehicle: boolean
}

export interface StoreCode {
  code: string
  percentOff: number
  expiresOn: string
  storeUrl: string
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

/**
 * The community parking and amenity fee.
 *
 * NOT a choice, and NOT recurring: one charge per UNIT, taken at sign-up. The
 * primary resident pays it and may authorise passes for the rest of the
 * household — a second or third person on the lease does not double it.
 *
 * Because it is collected at sign-up it rides the card rail like everything
 * else on the review screen, which is what makes a single payment honest here.
 * (This supersedes the earlier monthly-on-the-lease model; we have no rent
 * ledger to post to, so nothing claims one.)
 *
 * Distinct from ParkingTier below, which is an optional space-type upgrade a
 * property may or may not sell.
 */
export interface ParkingFee {
  label: string
  /**
   * Paid IN FULL at sign-up, per unit, covering a twelve-month term. Never
   * financed, never split into instalments — there is no partial-payment state
   * anywhere in this system, and adding one would create a resident who is
   * halfway through unlocking a gate.
   *
   * Set per property. This is not a platform constant; the admin surface edits
   * it per site.
   */
  amountCents: number
  /** What it covers, in the property's words. */
  covers: string
}

/**
 * A concession pass block.
 *
 * The property buys passes in blocks — 5 or 10 at a discounted unit price —
 * and receives promo codes to hand out. A resident redeems one at checkout and
 * the fee goes to zero; the property has already paid.
 *
 * This replaced "the property comps N dollars of the fee". The difference
 * matters: a block is inventory the property bought and can run out of, and
 * every code has to be traceable to the block it came from, or nobody can
 * answer why a resident's code was refused.
 */
export interface PromoCode {
  code: string
  /** Which purchased block it came from. */
  blockId: string
  /** What the property paid for this pass. Never shown to the resident. */
  costCents: number
  /** Cents of the fee it covers. Equals the full fee for a concession pass. */
  coversCents: number
  status: 'unused' | 'redeemed' | 'void' | 'expired'
  expiresOn: string | null
}

/** The outcome of typing a code into the box. */
export interface PromoResult {
  ok: boolean
  code: string
  coversCents: number
  /** Why it was refused, in the resident's words. */
  reason: string | null
}

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

/** A vehicle belongs to a person, and only a person with an active pass. */
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
  /** Set when the product comes from Shopify; the emoji is the fallback. */
  imageUrl?: string | null
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
  /**
   * Concession codes this property has issued. Server-side in production —
   * the client never receives the full list, it posts a code and gets a
   * verdict. Held here so the UX phase can run on mock data.
   */
  promoCodes: PromoCode[]
  /** Where this site's money goes. Never rendered to a resident. */
  split: SiteSplit
}

// ── Money routing ────────────────────────────────────────────────────────────

/**
 * Who gets paid on a transaction at this site.
 *
 * Four parties, and the mix differs site to site: a community sold by one rep
 * and serviced by another dealer splits differently from one we sold and
 * service ourselves. So this is site configuration, never a constant.
 *
 * The property is deliberately absent. The property receives no share of the
 * parking and amenity fee or of optional resident services — see the Property
 * Partnership Agreement.
 *
 * Shares are basis points so a three-way split of an odd amount is exact;
 * see lib/split.ts for the allocation, which is where rounding is decided
 * rather than left to whoever renders it.
 */
export type SplitParty =
  | 'gateguard'
  | 'hello_package'
  | 'sales_rep'
  | 'servicing_dealer'

export interface SplitShare {
  party: SplitParty
  /** Basis points of the net amount. All shares for a site must total 10000. */
  bps: number
  /** Stripe connected account, where one exists yet. */
  stripeAccountId: string | null
  /** Who this is, for the ledger and for a human reading a payout report. */
  label: string
}

export interface SiteSplit {
  siteSlug: string
  shares: SplitShare[]
}
