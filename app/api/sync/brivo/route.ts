import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sync/brivo
 *
 * Pulls residents directly from Brivo (per-site credentials) and upserts
 * them into gatecard.co's residents table.
 *
 * Triggered by Vercel Cron every hour. Can also be called manually.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 * Vercel Cron injects this automatically when CRON_SECRET env var is set.
 *
 * Optional query param ?siteSlug=xxx to sync a single site.
 */

interface BrivoTokenResponse {
  access_token: string
}

interface BrivoUser {
  id:           string
  firstName:    string
  lastName:     string
  phoneNumbers: { number: string }[]
  email?:       string
  customFields?: { fieldName: string; fieldValue: string }[]
}

async function getBrivoToken(authBasic: string, username: string, password: string): Promise<string> {
  const res = await fetch('https://auth.brivo.com/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization':  `Basic ${authBasic}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Accept':         '*/*',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    }).toString(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Brivo auth failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data: BrivoTokenResponse = await res.json()
  if (!data.access_token) throw new Error('Brivo auth: no access_token in response')
  return data.access_token
}

async function getBrivoUsers(apiKey: string, token: string): Promise<BrivoUser[]> {
  // Fetch up to 1000 users (pageSize max is 100 per call — paginate if needed)
  const users: BrivoUser[] = []
  let offset = 0
  const pageSize = 100

  while (true) {
    const res = await fetch(
      `https://api.brivo.com/v1/api/users?pageSize=${pageSize}&offset=${offset}`,
      {
        headers: {
          'Authorization': `bearer ${token}`,
          'api-key':       apiKey.trim(),
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Brivo users fetch failed (${res.status}): ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const page: BrivoUser[] = data.users || data.data || data.results || []

    users.push(...page)

    // If we got fewer than pageSize, we've reached the end
    if (page.length < pageSize) break
    offset += pageSize
  }

  return users
}

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth       = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteSlugFilter = req.nextUrl.searchParams.get('siteSlug')
  const db = supabaseAdmin()

  // ── Fetch sites with Brivo credentials ───────────────────────────────────────
  let sitesQuery = db
    .from('sites')
    .select('id, slug, name, brivo_api_key, brivo_auth_basic, brivo_username, brivo_password')
    .eq('active', true)
    .not('brivo_api_key', 'is', null)
    .not('brivo_auth_basic', 'is', null)
    .not('brivo_username', 'is', null)
    .not('brivo_password', 'is', null)

  if (siteSlugFilter) {
    sitesQuery = sitesQuery.eq('slug', siteSlugFilter)
  }

  const { data: sites, error: sitesErr } = await sitesQuery

  if (sitesErr || !sites?.length) {
    return NextResponse.json({
      ok:      true,
      synced:  0,
      message: siteSlugFilter
        ? 'Site not found or missing Brivo credentials'
        : 'No sites with Brivo credentials configured',
    })
  }

  const results: { slug: string; upserted: number; deactivated: number; error?: string }[] = []

  for (const site of sites) {
    try {
      // ── 1. Authenticate to Brivo ────────────────────────────────────────────
      const token = await getBrivoToken(
        site.brivo_auth_basic!,
        site.brivo_username!,
        site.brivo_password!
      )

      // ── 2. Fetch all users for this site's Brivo account ────────────────────
      const brivoUsers = await getBrivoUsers(site.brivo_api_key!, token)

      const now = new Date().toISOString()
      const activeUsers = brivoUsers.filter(u => u.id)

      // ── 3. Upsert active residents ───────────────────────────────────────────
      let upserted = 0
      if (activeUsers.length > 0) {
        const rows = activeUsers.map(u => {
          const firstName  = u.firstName?.trim() || ''
          const lastName   = u.lastName?.trim()  || ''
          // Display name uses first initial of last name for intercom privacy
          // e.g. "John Smith" → "John S."
          const lastInitial = lastName ? `${lastName.charAt(0).toUpperCase()}.` : ''
          const displayName = `${firstName} ${lastInitial}`.trim()

          return {
            site_id:        site.id,
            brivo_user_id:  String(u.id),
            first_name:     firstName || '(Unknown)',
            last_name:      lastName,
            display_name:   displayName,
            phone:          u.phoneNumbers?.[0]?.number || null,
            email:          u.email || null,
            unit_number:    null,   // Brivo doesn't expose unit reliably — update manually if needed
            active:         true,
            last_synced_at: now,
          }
        })

        const { error: upsertErr } = await db
          .from('residents')
          .upsert(rows, {
            onConflict:       'site_id, brivo_user_id',
            ignoreDuplicates: false,
          })

        if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`)
        upserted = rows.length
      }

      // ── 4. Deactivate residents no longer in Brivo ──────────────────────────
      const activeBrivoIds = activeUsers.map(u => String(u.id))
      let deactivated = 0

      if (activeBrivoIds.length > 0) {
        const { data: deactivatedRows, error: deactErr } = await db
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
          deactivated = deactivatedRows?.length ?? 0
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
