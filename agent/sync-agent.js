#!/usr/bin/env node
/**
 * agent/sync-agent.js
 *
 * GateCard — On-site Raspberry Pi sync agent
 * Supabase residents  ──▶  UniFi Access intercom directory
 *
 * Schedule (systemd timer, set in setup.sh):
 *   Runs once daily at 00:30 — after the Vercel Brivo cron refreshes Supabase.
 *   Can also be triggered manually at any time.
 *
 * Usage:
 *   node sync-agent.js            # run once and exit (used by systemd)
 *   node sync-agent.js --site=xxx # sync one site only
 *   node sync-agent.js --dry-run  # show diff without writing to UniFi
 *   node sync-agent.js --list     # print current UniFi directory and exit
 *
 * Environment (set in /etc/gatecard-agent.env — see setup.sh):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SITE_SLUG          (optional — restrict to one site)
 *   LOG_LEVEL          (optional — "debug" for verbose output)
 *
 * UniFi directory model (confirmed on-site May 2026):
 *   Each site has a "template" (intercom config) stored in sites.unifi_template_id.
 *   Directory entries are "rooms" within that template.
 *   List:   GET    /proxy/access/api/v2/callers/{templateId}/rooms
 *   Create: POST   /proxy/access/api/v2/callers/{templateId}/rooms/receivers
 *   Delete: DELETE /proxy/access/api/v2/callers/{templateId}/rooms/{roomId}
 *   Update: delete + recreate (no PATCH/PUT endpoint available)
 */

'use strict'

require('dotenv').config({ path: '/etc/gatecard-agent.env' })

const unifi    = require('./lib/unifi')
const supabase = require('./lib/supabase')

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIST    = args.includes('--list')
const DEBUG   = process.env.LOG_LEVEL === 'debug'

const SITE_SLUG = (() => {
  const flag = args.find(a => a.startsWith('--site='))
  return flag ? flag.split('=')[1] : (process.env.SITE_SLUG ?? null)
})()

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(msg)        { console.log(`[${ts()}] ${msg}`) }
function debug(msg)      { if (DEBUG) console.log(`[${ts()}] DEBUG ${msg}`) }
function err(msg, error) { console.error(`[${ts()}] ERROR ${msg}`, error?.message ?? error ?? '') }
function ts()            { return new Date().toISOString() }

// ─── Display name helper ──────────────────────────────────────────────────────

/**
 * Format resident name for the call box display.
 * Uses display_name from DB if set, otherwise falls back to unit number.
 */
function formatName(resident) {
  return resident.display_name || `Unit ${resident.unit_number}`
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Sync one site's residents into the UniFi Access intercom directory.
 *
 * Strategy:
 *   - residents.unifi_directory_id is the stable link between Supabase and UniFi.
 *   - New residents (no unifi_directory_id) → CREATE in UniFi → store returned ID
 *   - Existing residents → check if name/room changed → DELETE + CREATE if so
 *   - UniFi rooms with no matching active resident → DELETE from UniFi
 *
 * @param {object} site  { id, slug, name, unifi_controller_url, unifi_local_username,
 *                         unifi_local_password, unifi_template_id }
 * @param {boolean} dryRun  If true, log diffs but don't write to UniFi
 * @returns {Promise<{added, updated, deleted, skipped, error, status}>}
 */
async function syncSite(site, dryRun = false) {
  const start = Date.now()
  const stats = { added: 0, updated: 0, deleted: 0, skipped: 0, error: null, status: 'ok' }

  log(`[${site.slug}] Starting sync — controller: ${site.unifi_controller_url}`)

  if (!site.unifi_template_id) {
    const msg = `Site ${site.slug} has no unifi_template_id — set it in Supabase sites table`
    err(`[${site.slug}] ${msg}`)
    stats.error  = msg
    stats.status = 'error'
    stats.durationMs = Date.now() - start
    if (!dryRun) await supabase.writeSyncLog(site.id, stats)
    return stats
  }

  const templateId = site.unifi_template_id

  try {
    // 1. Login to local controller
    log(`[${site.slug}] Authenticating to local controller…`)
    const session = await unifi.login(
      site.unifi_controller_url,
      site.unifi_local_username,
      site.unifi_local_password
    )
    log(`[${site.slug}] ✓ Authenticated`)

    // 2. Fetch current UniFi directory rooms
    const rooms = await unifi.listDirectoryEntries(site.unifi_controller_url, session, templateId)
    log(`[${site.slug}] UniFi directory: ${rooms.length} rooms`)
    debug(`UniFi rooms: ${JSON.stringify(rooms, null, 2)}`)

    // Build lookup: UniFi room ID → room
    const roomsById = new Map(rooms.map(r => [r.id, r]))

    // 3. Fetch active residents from Supabase
    const residents = await supabase.getActiveResidents(site.id)
    log(`[${site.slug}] Supabase residents: ${residents.length} with phone`)
    debug(`Residents: ${JSON.stringify(residents, null, 2)}`)

    // Track which UniFi room IDs should exist after this sync
    const expectedRoomIds = new Set()

    // 4. Process each resident — create or update
    for (const resident of residents) {
      const name  = formatName(resident)
      const room  = String(resident.unit_number ?? '')
      const phone = resident.phone ?? null

      if (!phone) {
        debug(`[${site.slug}] Skipping ${name} — no phone number`)
        stats.skipped++
        continue
      }

      if (resident.unifi_directory_id) {
        // Resident already has a UniFi room entry
        const existing = roomsById.get(resident.unifi_directory_id)

        if (!existing) {
          // Room is gone from UniFi (manually deleted) — recreate it
          log(`[${site.slug}] Re-creating missing room for ${name} (unit ${room})`)
          if (!dryRun) {
            try {
              const created = await unifi.createDirectoryEntry(
                site.unifi_controller_url, session, templateId,
                { name, room, phone }
              )
              await supabase.setResidentUnifiId(resident.id, created.id)
              expectedRoomIds.add(created.id)
              stats.added++
            } catch (e) {
              err(`[${site.slug}] Failed to recreate ${name}:`, e)
              stats.error  = e.message
              stats.status = 'partial'
            }
          } else {
            log(`[${site.slug}] DRY-RUN: would recreate ${name}`)
            stats.added++
          }
          continue
        }

        expectedRoomIds.add(resident.unifi_directory_id)

        // Check if name or room number changed
        const nameChanged = existing.name !== name
        const roomChanged = existing.room !== room

        if (nameChanged || roomChanged) {
          log(`[${site.slug}] Updating ${name} (unit ${room})`)
          if (nameChanged) debug(`  name: "${existing.name}" → "${name}"`)
          if (roomChanged) debug(`  room: "${existing.room}" → "${room}"`)

          if (!dryRun) {
            try {
              // No PATCH endpoint — delete old entry and create fresh one
              await unifi.deleteDirectoryEntry(
                site.unifi_controller_url, session, templateId, resident.unifi_directory_id
              )
              const created = await unifi.createDirectoryEntry(
                site.unifi_controller_url, session, templateId,
                { name, room, phone }
              )
              await supabase.setResidentUnifiId(resident.id, created.id)
              expectedRoomIds.delete(resident.unifi_directory_id)
              expectedRoomIds.add(created.id)
              stats.updated++
            } catch (e) {
              err(`[${site.slug}] Failed to update ${name}:`, e)
              stats.error  = e.message
              stats.status = 'partial'
            }
          } else {
            log(`[${site.slug}] DRY-RUN: would update ${name}`)
            stats.updated++
          }
        } else {
          debug(`[${site.slug}] ${name} — no changes`)
          stats.skipped++
        }

      } else {
        // New resident — create room entry in UniFi
        log(`[${site.slug}] Adding ${name} (unit ${room}, ${phone})`)

        if (!dryRun) {
          try {
            const created = await unifi.createDirectoryEntry(
              site.unifi_controller_url, session, templateId,
              { name, room, phone }
            )
            await supabase.setResidentUnifiId(resident.id, created.id)
            expectedRoomIds.add(created.id)
            stats.added++
          } catch (e) {
            err(`[${site.slug}] Failed to add ${name}:`, e)
            stats.error  = e.message
            stats.status = 'partial'
          }
        } else {
          log(`[${site.slug}] DRY-RUN: would add ${name}`)
          stats.added++
        }
      }
    }

    // 5. Delete UniFi rooms that have no matching active resident
    for (const room of rooms) {
      if (expectedRoomIds.has(room.id)) continue

      log(`[${site.slug}] Removing stale room: "${room.name}" (unit ${room.room})`)

      if (!dryRun) {
        try {
          await unifi.deleteDirectoryEntry(
            site.unifi_controller_url, session, templateId, room.id
          )
          stats.deleted++
        } catch (e) {
          err(`[${site.slug}] Failed to delete "${room.name}":`, e)
          stats.error  = e.message
          stats.status = 'partial'
        }
      } else {
        log(`[${site.slug}] DRY-RUN: would delete "${room.name}"`)
        stats.deleted++
      }
    }

    // 6. Update site sync metadata
    if (!dryRun) {
      const finalCount = rooms.length + stats.added - stats.deleted
      await supabase.updateSiteSyncStatus(site.id, Math.max(0, finalCount))
    }

  } catch (e) {
    err(`[${site.slug}] Sync failed:`, e)
    stats.error  = e.message
    stats.status = 'error'
  }

  stats.durationMs = Date.now() - start

  // 7. Write audit log
  if (!dryRun) {
    await supabase.writeSyncLog(site.id, stats)
  }

  const emoji = stats.status === 'ok' ? '✅' : stats.status === 'partial' ? '⚠️' : '❌'
  log(
    `[${site.slug}] ${emoji} Done in ${stats.durationMs}ms — ` +
    `+${stats.added} added, ~${stats.updated} updated, -${stats.deleted} deleted, ` +
    `${stats.skipped} skipped${stats.error ? ` | error: ${stats.error}` : ''}`
  )

  return stats
}

// ─── List mode ────────────────────────────────────────────────────────────────

async function listMode(sites) {
  for (const site of sites) {
    if (!site.unifi_template_id) {
      log(`[${site.slug}] No unifi_template_id configured — skipping`)
      continue
    }
    log(`[${site.slug}] Listing UniFi directory…`)
    try {
      const session = await unifi.login(
        site.unifi_controller_url,
        site.unifi_local_username,
        site.unifi_local_password
      )
      const rooms = await unifi.listDirectoryEntries(
        site.unifi_controller_url, session, site.unifi_template_id
      )
      log(`[${site.slug}] ${rooms.length} rooms:`)
      rooms.forEach(r => {
        console.log(`  [${r.room}] ${r.name}  id=${r.id}`)
      })
    } catch (e) {
      err(`[${site.slug}] List failed:`, e)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('GateCard UniFi sync agent starting')
  if (DRY_RUN) log('⚠ DRY-RUN mode — no writes to UniFi or Supabase')

  let sites
  try {
    sites = await supabase.getActiveSites(SITE_SLUG)
  } catch (e) {
    err('Failed to fetch sites from Supabase:', e)
    process.exit(1)
  }

  if (!sites.length) {
    log(SITE_SLUG
      ? `No active site found with slug "${SITE_SLUG}" and UniFi controller configured`
      : 'No active sites with UniFi controller configured — nothing to do'
    )
    process.exit(0)
  }

  log(`Found ${sites.length} site(s): ${sites.map(s => s.slug).join(', ')}`)

  if (LIST) {
    await listMode(sites)
    process.exit(0)
  }

  let anyError = false
  for (const site of sites) {
    const result = await syncSite(site, DRY_RUN)
    if (result.status === 'error') anyError = true
  }

  log('All sites processed')
  process.exit(anyError ? 1 : 0)
}

main().catch(e => {
  err('Unhandled error in main:', e)
  process.exit(1)
})
