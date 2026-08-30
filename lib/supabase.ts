import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { configured, requireEnv } from './env'

/**
 * Server-side client, service role. Bypasses RLS.
 *
 * Every table in 200_move_in_portal.sql is service-role only, matching the
 * portal's pattern — resident data is reached through API routes, never from
 * the browser with an anon key. Resident-scoped RLS arrives with the Clerk JWT
 * mapping and is deliberately not guessed at yet.
 *
 * NEVER import this into a client component.
 */
let admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!configured.supabase()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'SUPABASE_SERVICE_ROLE_KEY (portal project: jtvxfmhlmokyuzdxxqpp).'
    )
  }
  if (!admin) {
    admin = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return admin
}
