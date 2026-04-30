import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { listHosts, listCloudDevices, UiDevice } from '@/lib/ubiquiti'

/**
 * GET /api/sync/ubiquiti
 *
 * Pulls device inventory from the UniFi Site Manager cloud API and updates
 * site records with current device info.
 *
 * Triggered by Vercel Cron daily at 08:00 UTC (3 AM ET).
 * Can also be called manually for a specific site.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 *
 * What it does:
 *  - Lists all hosts linked to UBIQUITI_CLOUD_API_KEY
 *  - For each active gatecard site with a ubiquiti_host_id:
 *      - Lists devices on that host
 *      - Finds Access devices (productLine === 'access')
 *      - Logs device inventory to console (read-only — no writes to ubiquiti)
 *      - Updates sites.ubiquiti_last_synced_at (future column)
 *
 * Note: The Site Manager API is READ-ONLY. Door unlock uses the local
 * controller API in lib/ubiquiti.ts#unlockDoor. This sync is for monitoring
 * device health and confirming door IDs are still valid.
 */

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip if cloud API key not configured — Ubiquiti is optional
  if (!process.env.UBIQUITI_CLOUD_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'UBIQUITI_CLOUD_API_KEY not set' })
  }

  const siteSlugFilter = req.nextUrl.searchParams.get('siteSlug')
  const db = supabaseAdmin()

  // ── Fetch gatecard sites that have a ubiquiti_host_id ─────────────────────
  let sitesQuery = db
    .from('sites')
    .select('id, slug, name, ubiquiti_host_id, ubiquiti_door_id')
    .eq('active', true)
    .not('ubiquiti_host_id', 'is', null)

  if (siteSlugFilter) {
    sitesQuery = sitesQuery.eq('slug', siteSlugFilter)
  }

  const { data: sites, error: sitesErr } = await sitesQuery

  if (sitesErr || !sites?.length) {
    return NextResponse.json({
      ok:      true,
      synced:  0,
      message: 'No sites with ubiquiti_host_id configured',
    })
  }

  // ── Pull cloud device list once (all hosts) ────────────────────────────────
  let allDevices: UiDevice[] = []
  let hostsError: string | null = null

  try {
    const hostIds = [...new Set(sites.map(s => s.ubiquiti_host_id).filter(Boolean))] as string[]
    allDevices = await listCloudDevices(hostIds)
  } catch (err) {
    hostsError = err instanceof Error ? err.message : String(err)
    console.error('[sync/ubiquiti] failed to fetch devices:', hostsError)
  }

  const results: {
    slug:        string
    hostId:      string | null
    totalDevices: number
    accessDevices: { id: string; name: string; model: string; online: boolean }[]
    configuredDoorFound: boolean
    error?: string
  }[] = []

  for (const site of sites) {
    if (hostsError) {
      results.push({
        slug:                site.slug,
        hostId:              site.ubiquiti_host_id,
        totalDevices:        0,
        accessDevices:       [],
        configuredDoorFound: false,
        error:               hostsError,
      })
      continue
    }

    // Devices belonging to this site's host
    const siteDevices = allDevices.filter(d => d.hostId === site.ubiquiti_host_id)

    // Access-product devices (door stations, intercom, door hubs)
    const accessDevices = siteDevices
      .filter(d => d.productLine === 'access')
      .map(d => ({
        id:     d.id,
        name:   d.name,
        model:  d.modelName || d.model,
        online: d.online,
      }))

    // Verify the configured door ID still exists
    const configuredDoorFound = !site.ubiquiti_door_id ||
      accessDevices.some(d => d.id === site.ubiquiti_door_id)

    if (!configuredDoorFound) {
      console.warn(
        `[sync/ubiquiti] ${site.slug}: configured door_id ${site.ubiquiti_door_id} not found in device list!`,
        'Available access devices:',
        accessDevices.map(d => `${d.id} (${d.name})`).join(', ')
      )
    }

    const offlineAccessDevices = accessDevices.filter(d => !d.online)
    if (offlineAccessDevices.length) {
      console.warn(
        `[sync/ubiquiti] ${site.slug}: ${offlineAccessDevices.length} access device(s) offline:`,
        offlineAccessDevices.map(d => d.name).join(', ')
      )
    }

    results.push({
      slug:                site.slug,
      hostId:              site.ubiquiti_host_id,
      totalDevices:        siteDevices.length,
      accessDevices,
      configuredDoorFound,
    })

    console.log(
      `[sync/ubiquiti] ${site.slug}: ${siteDevices.length} total, ${accessDevices.length} access devices, door configured: ${configuredDoorFound}`
    )
  }

  return NextResponse.json({
    ok:        true,
    timestamp: new Date().toISOString(),
    sites:     results,
  })
}
