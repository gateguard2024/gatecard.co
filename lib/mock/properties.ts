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
    parkingFee: {
      label: 'Parking & amenity fee',
      monthlyCents: 2500,
      covers: 'Gate access, the resident lot and community amenities',
    },
    directory: {
      mode: 'optional',
      defaultListed: true,
      formats: ['last_initial', 'full', 'unit_only'],
      note: 'Couriers use the callbox to reach you about packages.',
    },
  },
  resident: {
    firstName: 'Maya', lastName: 'Ellison', unitNumber: '214',
    moveInDate: '2026-09-05',
    email: 'm.ellison@example.com', mobile: null,
    householdMembers: [{ firstName: 'Andre', lastName: 'Ellison', invited: false }],
    leaseTermMonths: 12,
    leaseEndDate: '2027-09-04',
    // Partial, and it runs out before the lease does — the case most likely to
    // produce a confused call in month seven.
    concession: {
      coversCents: 1000,
      label: 'Covered by East Ponds',
      months: 6,
      endsOn: '2027-03-04',
    },
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
  // No tier rows: this property doesn't sell space types, so the screen is
  // pure vehicle registration and the picker disappears on its own.
  parkingTiers: [],
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
    parkingFee: {
      label: 'Parking & amenity fee',
      monthlyCents: 2000,
      covers: 'Gate access, the resident lot and community amenities',
    },
    // This property mandates listing — the gate is unstaffed and deliveries
    // fail outright when a resident can't be found.
    directory: {
      mode: 'required',
      defaultListed: true,
      formats: ['last_initial'],
      note: 'The gate is unstaffed, so couriers and guests rely on the directory.',
    },
  },
  resident: {
    firstName: 'Devin', lastName: 'Okafor', unitNumber: '1108',
    moveInDate: '2026-09-12',
    email: 'd.okafor@example.com', mobile: null,
    householdMembers: [],
    // A nine-month lease. Short terms are common and the fee has to behave.
    leaseTermMonths: 9,
    leaseEndDate: '2027-06-11',
    concession: null,
  },
  credentials: [
    { kind: 'phone', label: 'Phone key', priceCents: 0, isDefault: true, isPhysical: false,
      blurb: 'Your phone opens the gate and your building door. Live as soon as you finish here.',
      deliveryNote: null },
    { kind: 'fob', label: 'Key fob', priceCents: 1200, isDefault: false, isPhysical: true,
      blurb: 'A physical fob for the gate reader.',
      deliveryNote: 'Ships in 3–5 days. Activates on its first tap at the gate.' },
  ],
  parkingTiers: [],
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
    parkingFee: {
      label: 'Parking & amenity fee',
      monthlyCents: 7500,
      covers: 'Garage access, the lobby and building amenities',
    },
    // A staffed lobby means nobody depends on the directory to reach a
    // resident, so opting out costs nothing here — and the default reflects it.
    directory: {
      mode: 'optional',
      defaultListed: false,
      formats: ['unit_only', 'last_initial', 'full'],
      note: 'The concierge announces guests, so the directory is optional here.',
    },
  },
  resident: {
    firstName: 'Priya', lastName: 'Raman', unitNumber: '2207',
    moveInDate: '2026-09-01',
    email: 'p.raman@example.com', mobile: null,
    householdMembers: [
      { firstName: 'Nikhil', lastName: 'Raman', invited: true },
      { firstName: 'Asha', lastName: 'Raman', invited: false },
    ],
    leaseTermMonths: 12,
    leaseEndDate: '2027-08-31',
    concession: {
      coversCents: 7500,
      label: 'Covered by LYV Buckhead',
      months: null,        // the whole lease
      endsOn: null,
    },
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
  parkingTiers: [],
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
      'A partial concession that expires before the lease does',
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
      'Directory listing is mandatory — the gate is unstaffed',
      'A nine-month lease, so the fee is shown for the real term',
    ],
  },
  'lyv-buckhead': {
    headline: 'Nothing included — every parking tier is paid',
    points: [
      'The fee is fully comped by the property for the whole lease',
      'Two household members, one already invited',
      'A different accent colour, applied from the property record alone',
    ],
  },
}

export function getMoveInContext(slug: string): MoveInContext | null {
  return PROPERTIES[slug] ?? null
}
