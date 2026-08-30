import type { MoveInContext } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  EVERY PRICE, TIER NAME, COUNT AND DATE BELOW IS AN ILLUSTRATIVE
//     PLACEHOLDER. None of it came from Russel or from a real property.
//     Do not treat $15 fobs or $25 covered parking as real numbers.
//
// This file exists so the six screens can be judged as an experience before
// any backend is wired. It is the offer engine's OUTPUT for one property —
// the engine itself (D7) is a table, not this file.
// ─────────────────────────────────────────────────────────────────────────────

export const eastPonds: MoveInContext = {
  property: {
    slug: 'east-ponds',
    name: 'East Ponds',
    addressLine: '1400 Ponds Crossing',
    cityState: 'Atlanta, GA',
    accent: '#6CABD4',
    logoUrl: null,
    leasingPhone: '+14045550142',
    leasingHours: 'Mon–Fri 9–6 · Sat 10–4',
    supportEmail: 'leasing@eastponds.example',
  },

  resident: {
    firstName: 'Maya',
    lastName: 'Ellison',
    unitNumber: '214',
    moveInDate: '2026-09-05',
    email: 'm.ellison@example.com',
    mobile: null, // the one field the resident fills in on screen 01
    householdMembers: [
      { firstName: 'Andre', lastName: 'Ellison', invited: false },
    ],
  },

  // ── 02 · Access ────────────────────────────────────────────────────────────
  credentials: [
    {
      kind: 'phone',
      label: 'Phone key',
      blurb: 'Open the gate and your building door from your phone. Works the moment you finish here.',
      priceCents: 0,
      isDefault: true,
      isPhysical: false,
      deliveryNote: null,
    },
    {
      kind: 'fob',
      label: 'Key fob',
      blurb: 'A physical fob for the gate reader. Handy for guests in your household or a spare in the car.',
      priceCents: 1500,
      isDefault: false,
      isPhysical: true,
      deliveryNote: 'Ships in 3–5 days. Tap it at the gate once and it activates itself.',
    },
    {
      kind: 'keytag',
      label: 'Key tag',
      blurb: 'Same thing, smaller — rides on your keyring.',
      priceCents: 1000,
      isDefault: false,
      isPhysical: true,
      deliveryNote: 'Ships in 3–5 days. Tap it at the gate once and it activates itself.',
    },
  ],

  // ── 03 · Parking ───────────────────────────────────────────────────────────
  parkingTiers: [
    {
      id: 'surface',
      label: 'Surface lot',
      blurb: 'Open parking anywhere in the resident lot.',
      monthlyCents: 0,
      spacesAvailable: 40,
      included: true,
    },
    {
      id: 'covered',
      label: 'Covered space',
      blurb: 'Assigned space under the north canopy.',
      monthlyCents: 2500,
      spacesAvailable: 6,
      included: false,
    },
    {
      id: 'garage',
      label: 'Garage space',
      blurb: 'Assigned space in the gated garage, level 1.',
      monthlyCents: 6000,
      spacesAvailable: 0, // deliberately zero — exercises the waitlist state
      included: false,
    },
  ],

  // ── 04 · Services — offer engine output for THIS property ──────────────────
  services: [
    {
      id: 'internet',
      name: 'Internet',
      provider: 'Included with your lease',
      category: 'internet',
      blurb: 'East Ponds has building-wide internet. Nothing to buy — you just need to switch it on.',
      mode: 'included', // bulk ROE at this property (D7)
      monthlyCents: null,
      ctaLabel: 'Activate my connection',
      includedReason: 'Covered by your lease at East Ponds',
      leaseRequired: false,
    },
    {
      id: 'insurance',
      name: 'Renters insurance',
      provider: 'Assurant',
      category: 'insurance',
      blurb: 'Your lease requires coverage. This meets the requirement and files proof with the leasing office for you.',
      mode: 'sellable',
      monthlyCents: 1400,
      ctaLabel: 'Add coverage',
      includedReason: null,
      leaseRequired: true,
    },
    {
      id: 'security',
      name: 'In-unit security',
      provider: 'Gate Guard',
      category: 'security',
      blurb: 'Door sensors, a camera and 24/7 monitoring from the same team that runs the gate.',
      mode: 'quote', // configurator → deposit + monitoring (D6, reuses FORGE)
      monthlyCents: null,
      ctaLabel: 'Build my system',
      includedReason: null,
      leaseRequired: false,
    },
    {
      id: 'directv',
      name: 'DirecTV',
      provider: 'DirecTV',
      category: 'tv',
      blurb: '',
      mode: 'unavailable', // not offered at East Ponds — never rendered
      monthlyCents: null,
      ctaLabel: '',
      includedReason: null,
      leaseRequired: false,
    },
  ],

  // ── 05 · Store ─────────────────────────────────────────────────────────────
  store: [
    {
      id: 'fob-extra',
      name: 'Extra key fob',
      blurb: 'A spare for the household.',
      priceCents: 1500,
      imageEmoji: '🔑',
      fulfilment: 'credential', // Brivo enrollment, not a dropship SKU
      inStock: true,
    },
    {
      id: 'keytag-extra',
      name: 'Extra key tag',
      blurb: 'Rides on a keyring.',
      priceCents: 1000,
      imageEmoji: '🏷️',
      fulfilment: 'credential',
      inStock: true,
    },
    {
      id: 'doormat',
      name: 'East Ponds doormat',
      blurb: 'Coir, 18×30. Because unit 214 should look like it.',
      priceCents: 3400,
      imageEmoji: '🚪',
      fulfilment: 'merch',
      inStock: true,
    },
    {
      id: 'tumbler',
      name: 'Insulated tumbler',
      blurb: '20 oz, keeps coffee hot through a Monday.',
      priceCents: 2600,
      imageEmoji: '🥤',
      fulfilment: 'merch',
      inStock: true,
    },
    {
      id: 'tote',
      name: 'Canvas tote',
      blurb: 'For the walk back from the package room.',
      priceCents: 1800,
      imageEmoji: '👜',
      fulfilment: 'merch',
      inStock: false,
    },
    {
      id: 'plant',
      name: 'Welcome plant',
      blurb: 'A pothos. Genuinely hard to kill.',
      priceCents: 2200,
      imageEmoji: '🪴',
      fulfilment: 'merch',
      inStock: true,
    },
  ],
}

// ── Property registry — stands in for the sites table ────────────────────────
export const PROPERTIES: Record<string, MoveInContext> = {
  'east-ponds': eastPonds,
}

export function getMoveInContext(slug: string): MoveInContext | null {
  return PROPERTIES[slug] ?? null
}
