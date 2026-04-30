import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sync/brivo
 *
 * Pulls residents from the GateGuard portal's Brivo integration and upserts
 * them into gatecard.co's residents table.
 *
 * Triggered by Vercel Cron every hour. Can also be called manually.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 * Vercel Cron injects this automatically when CRON_SECRET env var is set.
 *
 * Optional query param ?siteSlug=xxx to sync a single site.
 *
 * ── Portal contract ────────────────────────────────────────────────────────
 * The GateGuard portal exposes:
 *
 *   GET /api/brivo/users?brivoSiteId=<id>
 *   Headers: x-internal-secret: <GATEGUARD_API_SECRET>
 *   Response: {
 *     users: [{
 *       id:          string   // Brivo user ID
 *       firstName:   string
 *       lastName:    string
 *       phone:       string | null   // E.164, from Brivo custom field
 *       email:       string | null
 *       unitNumber:  string | null   // from Brivo group/credential
 *       active:      boolean
 *     }]
 *   }
 */

interface BrivoUser {
  id:         string
  firstName:  string
  lastName:   string
  phone:      string | null
  email:      string | null
  unitNumber: string | null
  active:     boolean
}

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteSlugFilter = req.nextUrl.searchParams.get('siteSlug')

  const db = supabaseAdmin()

  // ── Fetch sites to sync ────────────────────────────────────────────────────
  let sitesQuery = db
    .from('sites')
    .select('id, slug, name, brivo_site_id')
    .eq('active', true)
    .not('brivo_site_id', 'is', null)

  if (siteSlugFilter) {
    sitesQuery = sitesQuery.eq('slug', siteSlugFilter)
  }

  const { data: sites, error: sitesErr } = await sitesQuery

  if (sitesErr || !sites?.length) {
    return NextResponse.json({
      ok:      true,
      synced:  0,
      message: siteSlugFilter ? 'Site not found or no brivo_site_id' : 'No sites with brivo_site_id',
    })
  }

  const results: { slug: string; upserted: number; deactivated: number; error?: string }[] = []

  for (const site of sites) {
    try {
      // ── 1. Fetch residents from GateGuard portal ───────────────────────────
      const portalUrl = process.env.GATEGUARD_PORTAL_URL ?? 'https://portal.gateguard.co'
      const res = await fetch(
        `${portalUrl}/api/brivo/users?brivoSiteId=${encodeURIComponent(site.brivo_site_id!)}`,
        {
          headers: {
            'x-internal-secret': process.env.GATEGUARD_API_SECRET ?? '',
            'Accept':            'application/json',
          },
          // 20 second timeout
          signal: AbortSignal.timeout(20_000),
        }
      )

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Portal returned ${res.status}: ${text.slice(0, 200)}`)
      }

      const { users }: { users: BrivoUser[] } = await res.json()

      if (!Array.isArray(users)) {
        throw new Error('Portal response missing users array')
      }

      const now = new Date().toISOString()

      // ── 2. Upsert active residents ─────────────────────────────────────────
      const activeUsers = users.filter(u => u.active && u.id)

      let upserted = 0
      if (activeUsers.length > 0) {
        const rows = activeUsers.map(u => ({
          site_id:        site.id,
          brivo_user_id:  u.id,
          first_name:     u.firstName?.trim() || '(Unknown)',
          last_name:      u.lastName?.trim()  || '',
          phone:          u.phone || null,
          email:          u.email || null,
          unit_number:    u.unitNumber || '?',
          active:         true,
          last_synced_at: now,
        }))

        const { error: upsertErr } = await db
          .from('residents')
          .upsert(rows, {
            onConflict:        'site_id, brivo_user_id',
            ignoreDuplicates:  false,
          })

        if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`)
        upserted = rows.length
      }

      // ── 3. Deactivate residents no longer in Brivo ─────────────────────────
      // Any resident for this site with a brivo_user_id NOT in the current
      // list gets marked inactive (moved out / removed in Yardi → Brivo).
      const activeBrivoIds = activeUsers.map(u => u.id)

      let deactivated = 0
      if (activeBrivoIds.length > 0) {
        const { data: deactivated_rows, error: deactErr } = await db
          .from('residents')
          .update({ active: false, last_synced_at: now })
          .eq('site_id', site.id)
          .eq('active', true)
          .not('brivo_user_id', 'is', null)
          .not('brivo_user_id', 'in', `(${activeBrivoIds.map(id => `"${id}"`).join(',')})`)
          .select('id')

        if (deactErr) {
          console.warn('[sync/brivo] deactivate error', site.slug, deactErr.message)
        } else {
          deactivated = deactivated_rows?.length ?? 0
        }
      }

      results.push({ slug: site.slug, upserted, deactivated })
      console.log(`[sync/brivo] ${site.slug}: +${upserted} upserted, -${deactivated} deactivated`)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sync/brivo] ${site.slug} error:`, msg)
      results.push({ slug: site.slug, upserted: 0, deactivated: 0, error: msg })
    }
  }

  return NextResponse.json({
    ok:        true,
    timestamp: new Date().toISOString(),
    sites:     results,
  })
}
