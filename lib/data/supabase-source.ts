import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  MoveInContext, CredentialOption, ParkingTier, ServiceOffer,
  StoreProduct, OfferMode, CredentialKind, DirectoryMode, DirectoryNameFormat,
} from '@/lib/types'
import type {
  SiteRow, ResidentRow, HouseholdRow, CredentialOptionRow, ParkingTierRow,
  ParkingAvailabilityRow, OfferRuleRow, StoreProductRow,
} from './rows'

/**
 * Reads a move-in context out of the portal's Supabase project.
 *
 * Returns exactly the shape lib/mock produces, so the screens cannot tell the
 * difference. Every property-specific decision comes from a table — the offer
 * engine especially. There is no branch in here that names a property.
 */
export async function fetchMoveInContext(
  slug: string,
  residentId?: string,
): Promise<MoveInContext | null> {
  const db = supabaseAdmin()

  const { data: site, error: siteErr } = await db
    .from('sites')
    .select('id, slug, name, address, city, state, accent_color, logo_url, ' +
            'leasing_phone, leasing_hours, support_email, move_in_enabled, ' +
            'directory_mode, directory_default_listed, directory_formats, directory_note, ' +
            'parking_fee_label, parking_fee_cents, parking_fee_covers')
    .eq('slug', slug)
    .eq('move_in_enabled', true)
    .maybeSingle()
    .returns<SiteRow>()

  if (siteErr) throw siteErr
  if (!site) return null

  // Resident: an explicit id when the link identifies one, otherwise the next
  // scheduled move-in at this property. Auth replaces the fallback.
  const residentQ = db
    .from('residents')
    .select('id, first_name, last_name, unit_number, email, phone, move_in_date, ' +
            'household_id, lease_term_months, lease_end_date')
    .eq('site_id', site.id)
    .eq('active', true)

  const { data: resident, error: resErr } = residentId
    ? await residentQ.eq('id', residentId).maybeSingle().returns<ResidentRow>()
    : await residentQ.order('move_in_date', { ascending: true }).limit(1)
        .maybeSingle().returns<ResidentRow>()

  if (resErr) throw resErr
  if (!resident) return null

  const [creds, tiers, avail, offers, store, household, concession] = await Promise.all([
    db.from('site_credential_options')
      .select('kind, label, blurb, price_cents, is_default, is_physical, delivery_note')
      .eq('site_id', site.id).eq('active', true).order('sort_order')
      .returns<CredentialOptionRow[]>(),

    db.from('site_parking_tiers')
      .select('id, code, label, blurb, monthly_cents, included, total_spaces')
      .eq('site_id', site.id).eq('active', true).order('sort_order')
      .returns<ParkingTierRow[]>(),

    db.from('site_parking_availability')
      .select('tier_id, spaces_available')
      .eq('site_id', site.id).returns<ParkingAvailabilityRow[]>(),

    db.from('site_offer_rules')
      .select('id, mode, resident_price_cents, billing_period, included_reason, ' +
              'cta_label, lease_required, service_catalog(name, provider, category, description)')
      .eq('site_id', site.id).eq('active', true).order('sort_order')
      .returns<OfferRuleRow[]>(),

    db.from('site_store_products')
      .select('id, name, blurb, price_cents, image_emoji, fulfilment, in_stock')
      .or(`site_id.eq.${site.id},site_id.is.null`)
      .eq('active', true).order('sort_order').returns<StoreProductRow[]>(),

    resident.household_id
      ? db.from('residents')
          .select('first_name, last_name')
          .eq('household_id', resident.household_id)
          .neq('id', resident.id).returns<HouseholdRow[]>()
      : Promise.resolve({ data: [] as HouseholdRow[], error: null }),

    db.from('resident_concessions')
      .select('covers_cents, label, months, ends_on')
      .eq('resident_id', resident.id)
      .eq('status', 'active')
      .maybeSingle()
      .returns<{
        covers_cents: number; label: string | null
        months: number | null; ends_on: string | null
      }>(),
  ])

  for (const r of [creds, tiers, avail, offers, store, household]) {
    if (r.error) throw r.error
  }

  const availByTier = new Map<string, number>(
    (avail.data ?? []).map(a => [a.tier_id, a.spaces_available])
  )

  return {
    property: {
      slug: site.slug!,
      name: site.name,
      addressLine: site.address ?? '',
      cityState: [site.city, site.state].filter(Boolean).join(', '),
      // Falls back to the house steel blue when a property hasn't set one.
      accent: site.accent_color ?? '#6CABD4',
      logoUrl: site.logo_url ?? null,
      leasingPhone: site.leasing_phone ?? '',
      leasingHours: site.leasing_hours ?? '',
      supportEmail: site.support_email ?? '',
      directory: {
        mode: (site.directory_mode ?? 'optional') as DirectoryMode,
        defaultListed: site.directory_default_listed ?? true,
        formats: (site.directory_formats?.length
          ? site.directory_formats
          : ['last_initial']) as DirectoryNameFormat[],
        note: site.directory_note ?? null,
      },
      parkingFee: site.parking_fee_cents
        ? {
            label: site.parking_fee_label ?? 'Parking & amenity fee',
            monthlyCents: site.parking_fee_cents,
            covers: site.parking_fee_covers ?? '',
          }
        : null,
    },

    resident: {
      firstName: resident.first_name,
      lastName: resident.last_name,
      unitNumber: resident.unit_number,
      moveInDate: resident.move_in_date ?? new Date().toISOString().slice(0, 10),
      email: resident.email,
      // The roster's number is a prefill, not a confirmation — screen 01 asks
      // for it because this is the field the sync most often lacks.
      mobile: null,
      householdMembers: (household.data ?? []).map(m => ({
        firstName: m.first_name, lastName: m.last_name, invited: false,
      })),
      leaseTermMonths: resident.lease_term_months,
      leaseEndDate: resident.lease_end_date,
      concession: concession.data
        ? {
            coversCents: concession.data.covers_cents,
            label: concession.data.label ?? `Covered by ${site.name}`,
            months: concession.data.months,
            endsOn: concession.data.ends_on,
          }
        : null,
    },

    credentials: (creds.data ?? []).map((c): CredentialOption => ({
      kind: c.kind as CredentialKind,
      label: c.label,
      blurb: c.blurb ?? '',
      priceCents: c.price_cents,
      isDefault: c.is_default,
      isPhysical: c.is_physical,
      deliveryNote: c.delivery_note,
    })),

    parkingTiers: (tiers.data ?? []).map((t): ParkingTier => ({
      id: t.code,
      label: t.label,
      blurb: t.blurb ?? '',
      monthlyCents: t.monthly_cents,
      // Live count from the view, not the configured total.
      spacesAvailable: availByTier.get(t.id) ?? 0,
      included: t.included,
    })),

    services: (offers.data ?? []).map((o): ServiceOffer => {
      const svc = o.service_catalog
      return {
        id: o.id,
        name: svc?.name ?? '',
        provider: svc?.provider ?? '',
        category: (svc?.category ?? 'other') as ServiceOffer['category'],
        blurb: svc?.description ?? '',
        mode: o.mode as OfferMode,
        monthlyCents: o.resident_price_cents ?? null,
        ctaLabel: o.cta_label ?? 'Add',
        includedReason: o.included_reason,
        leaseRequired: o.lease_required,
      }
    }),

    store: (store.data ?? []).map((p): StoreProduct => ({
      id: p.id,
      name: p.name,
      blurb: p.blurb ?? '',
      priceCents: p.price_cents,
      imageEmoji: p.image_emoji ?? '📦',
      fulfilment: p.fulfilment as StoreProduct['fulfilment'],
      inStock: p.in_stock,
    })),
  }
}
