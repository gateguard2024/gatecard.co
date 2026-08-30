import type { MoveInContext } from '@/lib/types'

/**
 * Demo properties.
 *
 * ⚠️  ALL FICTIONAL. Every name, price, tier, count and address is invented.
 *     No real resident, property or price appears here.
 *
 * Three properties rather than one, because the offer engine's entire claim is
 * that properties differ — and a single-property demo can't show that. Each one
 * exercises a different configuration:
 *
 *   east-ponds       bulk internet ROE (included, not sellable), DirecTV absent,
 *                    a sold-out garage tier, a household member, insurance
 *                    required by the lease
 *   camp-creek       no bulk deal, so internet and DirecTV are both sellable;
 *                    credential-only store, no merch; insurance optional
 *   lyv-buckhead     nothing included — every parking tier is paid, which is the
 *                    edge case where the resident must actively choose one
 *
 * The screens contain no property names. If one of these renders differently,
 * it is because its data differs.
 */

const eastPonds: MoveInContext = {
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
    firstName: 'Maya', lastName: 'Ellison', unitNumber: '214',
    moveInDate: '2026-09-05',
    email: 'm.ellison@example.com', mobile: null,
    householdMembers: [{ firstName: 'Andre', lastName: 'Ellison', invited: false }],
  },
  credentials: [
    { kind: 'phone', label: 'Phone key', priceCents: 0, isDefault: true, isPhysical: false,
      blurb: 'Open the gate and your building door from your phone. Works the moment you finish here.',
      deliveryNote: null },
    { kind: 'fob', label: 'Key fob', priceCents: 1500, isDefault: false, isPhysical: true,
      blurb: 'A physical fob for the gate reader. Handy for guests in your household or a spare in the car.',
      deliveryNote: 'Ships in 3–5 days. Tap it at the gate once and it activates itself.' },
    { kind: 'keytag', label: 'Key tag', priceCents: 1000, isDefault: false, isPhysical: true,
      blurb: 'Same thing, smaller — rides on your keyring.',
      deliveryNote: 'Ships in 3–5 days. Tap it at the gate once and it activates itself.' },
  ],
  parkingTiers: [
    { id: 'surface', label: 'Surface lot', monthlyCents: 0, included: true, spacesAvailable: 40,
      blurb: 'Open parking anywhere in the resident lot.' },
    { id: 'covered', label: 'Covered space', monthlyCents: 2500, included: false, spacesAvailable: 6,
      blurb: 'Assigned space under the north canopy.' },
    { id: 'garage', label: 'Garage space', monthlyCents: 6000, included: false, spacesAvailable: 0,
      blurb: 'Assigned space in the gated garage, level 1.' },
  ],
  services: [
    { id: 'internet', name: 'Internet', provider: 'Included with your lease', category: 'internet',
      blurb: 'East Ponds has building-wide internet. Nothing to buy — you just need to switch it on.',
      mode: 'included', monthlyCents: null, ctaLabel: 'Activate my connection',
      includedReason: 'Covered by your lease at East Ponds', leaseRequired: false },
    { id: 'insurance', name: 'Renters insurance', provider: 'Assurant', category: 'insurance',
      blurb: 'Your lease requires coverage. This meets the requirement and files proof with the leasing office for you.',
      mode: 'sellable', monthlyCents: 1400, ctaLabel: 'Add coverage',
      includedReason: null, leaseRequired: true },
    { id: 'security', name: 'In-unit security', provider: 'Gate Guard', category: 'security',
      blurb: 'Door sensors, a camera and 24/7 monitoring from the same team that runs the gate.',
      mode: 'quote', monthlyCents: null, ctaLabel: 'Build my system',
      includedReason: null, leaseRequired: false },
    { id: 'directv', name: 'DirecTV', provider: 'DirecTV', category: 'tv', blurb: '',
      mode: 'unavailable', monthlyCents: null, ctaLabel: '',
      includedReason: null, leaseRequired: false },
  ],
  store: [
    { id: 'fob-extra', name: 'Extra key fob', blurb: 'A spare for the household.',
      priceCents: 1500, imageEmoji: '🔑', fulfilment: 'credential', inStock: true },
    { id: 'keytag-extra', name: 'Extra key tag', blurb: 'Rides on a keyring.',
      priceCents: 1000, imageEmoji: '🏷️', fulfilment: 'credential', inStock: true },
    { id: 'doormat', name: 'East Ponds doormat', blurb: 'Coir, 18×30. Because unit 214 should look like it.',
      priceCents: 3400, imageEmoji: '🚪', fulfilment: 'merch', inStock: true },
    { id: 'tumbler', name: 'Insulated tumbler', blurb: '20 oz, keeps coffee hot through a Monday.',
      priceCents: 2600, imageEmoji: '🥤', fulfilment: 'merch', inStock: true },
    { id: 'tote', name: 'Canvas tote', blurb: 'For the walk back from the package room.',
      priceCents: 1800, imageEmoji: '👜', fulfilment: 'merch', inStock: false },
    { id: 'plant', name: 'Welcome plant', blurb: 'A pothos. Genuinely hard to kill.',
      priceCents: 2200, imageEmoji: '🪴', fulfilment: 'merch', inStock: true },
  ],
}

/** No bulk internet deal here, so internet and TV are both real line items. */
const campCreek: MoveInContext = {
  property: {
    slug: 'camp-creek',
    name: 'Rhythm at Camp Creek',
    addressLine: '3820 Camp Creek Parkway',
    cityState: 'East Point, GA',
    accent: '#C8A45A',
    logoUrl: null,
    leasingPhone: '+14045550188',
    leasingHours: 'Mon–Fri 9–6',
    supportEmail: 'leasing@rhythmcampcreek.example',
  },
  resident: {
    firstName: 'Devin', lastName: 'Okafor', unitNumber: '1108',
    moveInDate: '2026-09-12',
    email: 'd.okafor@example.com', mobile: null,
    householdMembers: [],
  },
  credentials: [
    { kind: 'phone', label: 'Phone key', priceCents: 0, isDefault: true, isPhysical: false,
      blurb: 'Your phone opens the gate and your building door. Live as soon as you finish here.',
      deliveryNote: null },
    { kind: 'fob', label: 'Key fob', priceCents: 1200, isDefault: false, isPhysical: true,
      blurb: 'A physical fob for the gate reader.',
      deliveryNote: 'Ships in 3–5 days. Activates on its first tap at the gate.' },
  ],
  parkingTiers: [
    { id: 'surface', label: 'Resident lot', monthlyCents: 0, included: true, spacesAvailable: 88,
      blurb: 'Open parking in the main resident lot.' },
    { id: 'reserved', label: 'Reserved space', monthlyCents: 3500, included: false, spacesAvailable: 12,
      blurb: 'A numbered space near your building entrance.' },
  ],
  services: [
    { id: 'internet', name: 'Internet', provider: 'Gate Guard Fiber', category: 'internet',
      blurb: '500 Mbps symmetric, installed before you move in. No contract.',
      mode: 'sellable', monthlyCents: 5999, ctaLabel: 'Add internet',
      includedReason: null, leaseRequired: false },
    { id: 'directv', name: 'DirecTV', provider: 'DirecTV', category: 'tv',
      blurb: 'We pass your details to DirecTV and they schedule the install. Pricing is theirs, not ours.',
      mode: 'sellable', monthlyCents: 6999, ctaLabel: 'Request a call',
      includedReason: null, leaseRequired: false },
    { id: 'insurance', name: 'Renters insurance', provider: 'Assurant', category: 'insurance',
      blurb: 'Optional here, but most residents carry it.',
      mode: 'sellable', monthlyCents: 1200, ctaLabel: 'Add coverage',
      includedReason: null, leaseRequired: false },
  ],
  // Credential items only — this property runs no merch programme.
  store: [
    { id: 'fob-extra', name: 'Extra key fob', blurb: 'A spare for the household.',
      priceCents: 1200, imageEmoji: '🔑', fulfilment: 'credential', inStock: true },
    { id: 'keytag-extra', name: 'Key tag', blurb: 'Rides on a keyring.',
      priceCents: 900, imageEmoji: '🏷️', fulfilment: 'credential', inStock: true },
  ],
}

/** Nothing is included — the resident has to actively choose a paid tier. */
const lyvBuckhead: MoveInContext = {
  property: {
    slug: 'lyv-buckhead',
    name: 'LYV Buckhead',
    addressLine: '3344 Peachtree Road NE',
    cityState: 'Atlanta, GA',
    accent: '#8E9BD4',
    logoUrl: null,
    leasingPhone: '+14045550170',
    leasingHours: 'Mon–Sat 9–7 · Sun 12–5',
    supportEmail: 'concierge@lyvbuckhead.example',
  },
  resident: {
    firstName: 'Priya', lastName: 'Raman', unitNumber: '2207',
    moveInDate: '2026-09-01',
    email: 'p.raman@example.com', mobile: null,
    householdMembers: [
      { firstName: 'Nikhil', lastName: 'Raman', invited: true },
      { firstName: 'Asha', lastName: 'Raman', invited: false },
    ],
  },
  credentials: [
    { kind: 'phone', label: 'Phone key', priceCents: 0, isDefault: true, isPhysical: false,
      blurb: 'Opens the garage, the lobby, your elevator bank and your door.',
      deliveryNote: null },
    { kind: 'fob', label: 'Key fob', priceCents: 2000, isDefault: false, isPhysical: true,
      blurb: 'For guests in your household, or a spare in the car.',
      deliveryNote: 'Ships in 3–5 days. Activates on its first tap.' },
    { kind: 'keytag', label: 'Key tag', priceCents: 1500, isDefault: false, isPhysical: true,
      blurb: 'Smaller, rides on a keyring.',
      deliveryNote: 'Ships in 3–5 days. Activates on its first tap.' },
  ],
  // Every tier costs money. Tower properties often have no free parking at all.
  parkingTiers: [
    { id: 'garage-standard', label: 'Garage, standard', monthlyCents: 7500, included: false,
      spacesAvailable: 24, blurb: 'Levels 3–5, unassigned.' },
    { id: 'garage-reserved', label: 'Garage, reserved', monthlyCents: 12500, included: false,
      spacesAvailable: 4, blurb: 'A numbered space on level 2, near the elevator.' },
    { id: 'ev', label: 'EV space', monthlyCents: 15000, included: false, spacesAvailable: 0,
      blurb: 'Level 2, with a dedicated 48A charger.' },
  ],
  services: [
    { id: 'internet', name: 'Internet', provider: 'Included with your lease', category: 'internet',
      blurb: 'Gigabit is part of your amenity fee. You just need to activate it.',
      mode: 'included', monthlyCents: null, ctaLabel: 'Activate my connection',
      includedReason: 'Covered by your amenity fee', leaseRequired: false },
    { id: 'insurance', name: 'Renters insurance', provider: 'Assurant', category: 'insurance',
      blurb: 'Your lease requires coverage. We file proof with the concierge for you.',
      mode: 'sellable', monthlyCents: 1800, ctaLabel: 'Add coverage',
      includedReason: null, leaseRequired: true },
    { id: 'security', name: 'In-unit security', provider: 'Gate Guard', category: 'security',
      blurb: 'Door and window sensors, a camera, and monitoring from our own operations centre.',
      mode: 'quote', monthlyCents: null, ctaLabel: 'Build my system',
      includedReason: null, leaseRequired: false },
  ],
  store: [
    { id: 'fob-extra', name: 'Extra key fob', blurb: 'A spare for the household.',
      priceCents: 2000, imageEmoji: '🔑', fulfilment: 'credential', inStock: true },
    { id: 'keytag-extra', name: 'Key tag', blurb: 'Rides on a keyring.',
      priceCents: 1500, imageEmoji: '🏷️', fulfilment: 'credential', inStock: true },
    { id: 'wine', name: 'Wine fridge stocker', blurb: 'Six bottles, chosen by the concierge.',
      priceCents: 12000, imageEmoji: '🍷', fulfilment: 'merch', inStock: true },
    { id: 'plant', name: 'Welcome plant', blurb: 'A fiddle-leaf fig. Less forgiving than a pothos.',
      priceCents: 4800, imageEmoji: '🪴', fulfilment: 'merch', inStock: true },
  ],
}

export const PROPERTIES: Record<string, MoveInContext> = {
  'east-ponds': eastPonds,
  'camp-creek': campCreek,
  'lyv-buckhead': lyvBuckhead,
}

/** What each demo property is here to show. Rendered on the demo index. */
export const DEMO_NOTES: Record<string, { headline: string; points: string[] }> = {
  'east-ponds': {
    headline: 'Bulk internet, a sold-out tier, a household',
    points: [
      'Internet is included, so its card is an activation helper with no price',
      'DirecTV is unavailable here and never renders at all',
      'The garage tier is at zero — shown, disabled, with a waitlist',
      'Insurance is flagged as required by the lease',
      'A second person on the lease gets their own link, not a shared session',
    ],
  },
  'camp-creek': {
    headline: 'No bulk deal, so internet is a real line item',
    points: [
      'Internet and DirecTV are both sellable, with monthly prices',
      'Insurance is optional here — same product, no lease badge',
      'The store carries credentials only, no merch programme',
      'One credential option instead of three',
    ],
  },
  'lyv-buckhead': {
    headline: 'Nothing included — every parking tier is paid',
    points: [
      'No free tier, so the resident has to actively choose one',
      'An EV tier at zero availability',
      'Two household members, one already invited',
      'A different accent colour, applied from the property record alone',
    ],
  },
}

export function getMoveInContext(slug: string): MoveInContext | null {
  return PROPERTIES[slug] ?? null
}
