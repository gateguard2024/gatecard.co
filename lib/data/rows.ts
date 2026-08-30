/**
 * Row shapes for the tables in 200_move_in_portal.sql.
 *
 * Hand-written because the schema isn't applied yet, so there is nothing to
 * generate from. Once the migration has run on portal's beta project, replace
 * this file with `supabase gen types typescript` output and delete the
 * `.returns<>()` calls in supabase-source.ts — they exist only to give the
 * client the types it can't infer on its own.
 */

export interface SiteRow {
  id: string
  slug: string | null
  name: string
  address: string | null
  city: string | null
  state: string | null
  accent_color: string | null
  logo_url: string | null
  leasing_phone: string | null
  leasing_hours: string | null
  support_email: string | null
  move_in_enabled: boolean
  directory_mode: string | null
  directory_default_listed: boolean | null
  directory_formats: string[] | null
  directory_note: string | null
  parking_fee_label: string | null
  parking_fee_cents: number | null
  parking_fee_covers: string | null
}

export interface ResidentRow {
  id: string
  first_name: string
  last_name: string
  unit_number: string
  email: string | null
  phone: string | null
  move_in_date: string | null
  household_id: string | null
}

export interface HouseholdRow {
  first_name: string
  last_name: string
}

export interface CredentialOptionRow {
  kind: string
  label: string
  blurb: string | null
  price_cents: number
  is_default: boolean
  is_physical: boolean
  delivery_note: string | null
}

export interface ParkingTierRow {
  id: string
  code: string
  label: string
  blurb: string | null
  monthly_cents: number
  included: boolean
  total_spaces: number
}

export interface ParkingAvailabilityRow {
  tier_id: string
  spaces_available: number
}

/** service_catalog joins in as an object, or null when the FK is unset. */
export interface OfferRuleRow {
  id: string
  mode: string
  resident_price_cents: number | null
  billing_period: string
  included_reason: string | null
  cta_label: string | null
  lease_required: boolean
  service_catalog: {
    name: string | null
    provider: string | null
    category: string | null
    description: string | null
  } | null
}

export interface StoreProductRow {
  id: string
  name: string
  blurb: string | null
  price_cents: number
  image_emoji: string | null
  fulfilment: string
  in_stock: boolean
}
