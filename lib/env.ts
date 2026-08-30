/**
 * Which integrations are actually configured.
 *
 * Nothing in this app may assume a service exists. Until the env is filled in,
 * every client stays dark and the portal runs on mock data — so the UX is
 * reviewable, and a half-configured deploy fails loudly at the edge rather
 * than quietly halfway through a resident's move-in.
 */

const has = (...keys: string[]) =>
  keys.every(k => Boolean(process.env[k] && process.env[k]!.trim()))

export const configured = {
  /** Portal's Supabase project — jtvxfmhlmokyuzdxxqpp. */
  supabase: () => has('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
  clerk:    () => has('CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
  stripe:   () => has('STRIPE_SECRET_KEY'),
  connect:  () => has('STRIPE_SECRET_KEY', 'STRIPE_CONNECT_CLIENT_ID'),
  brivo:    () => has('BRIVO_AUTH_BASIC', 'BRIVO_API_KEY', 'BRIVO_USERNAME', 'BRIVO_PASSWORD'),
  shopify:  () => has('SHOPIFY_STORE_DOMAIN', 'SHOPIFY_STOREFRONT_ACCESS_TOKEN'),
  inngest:  () => has('INNGEST_EVENT_KEY'),
  twilio:   () => has('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'),
  resend:   () => has('RESEND_API_KEY', 'RESEND_FROM_EMAIL'),
}

/** Days a commission is held before release. Refunds land inside this window. */
export const COMMISSION_HOLD_DAYS = Number(process.env.COMMISSION_HOLD_DAYS ?? 30)

export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set`)
  return v
}
