import { NextResponse, type NextRequest } from 'next/server'
import { configured } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'
import { syncSite, type SiteSyncConfig } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SITE_FIELDS =
  'id, slug, name, accent_color, leasing_phone, pm_email, primary_contact_email, ops_email, ' +
  'brivo_sync_mode, auto_invite_residents, move_out_confirm_runs, move_out_grace_hours, ' +
  'roster_shrink_guard_pct, brivo_unit_field, brivo_unit_source, brivo_unit_pattern, ' +
  'brivo_unit_exclude, brivo_topology_ttl_minutes, brivo_auth_basic, brivo_api_key, ' +
  'brivo_username, brivo_password'

/**
 * Roster sync for every site with it enabled.
 *
 * Runs on a schedule and can be called by hand. Sites are processed
 * independently — one property's Brivo account being down must not stop the
 * others, so failures are caught per site and reported, never thrown.
 *
 * ?siteSlug=x limits it to one property, which is what you want when
 * onboarding or debugging.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!configured.supabase()) {
    return NextResponse.json(
      { error: 'not_configured', detail: 'Supabase env is not set.' }, { status: 503 })
  }

  const slug = req.nextUrl.searchParams.get('siteSlug')
  const db = supabaseAdmin()

  let q = db.from('sites').select(SITE_FIELDS).neq('brivo_sync_mode', 'off')
  if (slug) q = q.eq('slug', slug)

  const { data: sites, error } = await q.returns<SiteSyncConfig[]>()
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 })
  if (!sites?.length) {
    return NextResponse.json({ ok: true, sites: [], message: 'No sites have roster sync enabled.' })
  }

  const results: { slug: string | null; summary: string; error?: string }[] = []
  for (const site of sites) {
    try {
      const { summary } = await syncSite(site)
      results.push({ slug: site.slug, summary })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sync/brivo] ${site.slug} failed:`, msg)
      results.push({ slug: site.slug, summary: 'failed', error: msg })
    }
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), sites: results })
}
