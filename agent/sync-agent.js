#!/usr/bin/env node
/**
 * agent/sync-agent.js
 *
 * GateCard — On-site Raspberry Pi sync agent
 * Supabase residents  ──▶  UniFi Access intercom directory
 *
 * Schedule (systemd timer, set in setup.sh):
 *   Runs at :30 past 0h, 6h, 12h, 18h — always 30 minutes AFTER the
 *   Vercel Brivo cron (which runs at :00) so Supabase is always fresh.
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
 * Matches the existing display_name format: "Smith, J."
 * Falls back to display_name from DB if set, otherwise builds it.
 */
function formatName(resident) {
  return resident.display_name || `${resident.unit_number}`
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Sync one site's residents into the UniFi Access intercom directory.
 *
 * Strategy:
 *   - residents.unifi_directory_id is the stable link between Supabase and UniFi.
 *   - New residents (no unifi_directory_id) → CREATE in UniFi → store returned ID
 *   - Existing residents (has unifi_directory_id) → check if name/phone changed → UPDATE if so
 *   - UniFi entries with no matching active resident → DELETE from UniFi
 *
 * @param {object} site  { id, slug, name, unifi_controller_url, unifi_local_username, unifi_local_password }
 * @param {boolean} dryRun  If true, log diffs but don't write to UniFi
 * @returns {Promise<{added, updated, deleted, skipped, error, status}>}
 */
async function syncSite(site, dryRun = false) {
  const start = Date.now()
  const stats = { added: 0, updated: 0, deleted: 0, skipped: 0, error: null, status: 'ok' }

  log(`[${site.slug}] Starting sync — controller: ${site.unifi_controller_url}`)

  try {
    // 1. Login to local controller
    log(`[${site.slug}] Authenticating to local controller…`)
    const session = await unifi.login(
      site.unifi_controller_url,
      site.unifi_local_username,
      site.unifi_local_password
    )
    log(`[${site.slug}] ✓ Authenticated`)

    // 2. Fetch current UniFi directory entries
    const unifiEntries = await unifi.listDirectoryEntries(site.unifi_controller_url, session)
    log(`[${site.slug}] UniFi directory: ${unifiEntries.length} entries`)
    debug(`UniFi entries: ${JSON.stringify(unifiEntries, null, 2)}`)

    // Build lookup: UniFi ID → entry
    const unifiById = new Map(unifiEntries.map(e => [e.id, e]))

    // 3. Fetch active residents from Supabase
    const residents = await supabase.getActiveResidents(site.id)
    log(`[${site.slug}] Supabase residents: ${residents.length} with phone`)
    debug(`Residents: ${JSON.stringify(residents, null, 2)}`)

    // Build set of UniFi IDs that should exist (mapped residents)
    const expectedUnifiIds = new Set()

    // 4. Process each resident — create or update
    for (const resident of residents) {
      const name        = formatName(resident)
      const dialNumber  = resident.unit_number ?? ''
      const phone       = resident.phone ?? null

      if (!phone) {
        debug(`[${site.slug}] Skipping ${name} — no phone number`)
        stats.skipped++
        continue
      }

      if (resident.unifi_directory_id) {
        // Resident already has a UniFi entry — check if it needs updating
        expectedUnifiIds.add(resident.unifi_directory_id)
        const existing = unifiById.get(resident.unifi_directory_id)

        if (!existing) {
          // UniFi entry is gone (maybe manually deleted) — recreate it
          log(`[${site.slug}] Re-creating missing entry for ${name} (unit ${dialNumber})`)
          if (!dryRun) {
            try {
              const created = await unifi.upsertDirectoryEntry(
                site.unifi_controller_url, session,
                { name, dial_number: dialNumber, phone }
              )
              await supabase.setResidentUnifiId(resident.id, created.id)
              expectedUnifiIds.add(created.id)
              stats.added++
            } catch (e) {
              err(`[${site.slug}] Failed to recreate ${name}:`, e)
              stats.error = e.message
              stats.status = 'partial'
            }
          } else {
            log(`[${site.slug}] DRY-RUN: would recreate ${name}`)
            stats.added++
          }
          continue
        }

        // Check if anything changed
        const nameChanged  = existing.name        !== name
        const phoneChanged = existing.phone       !== phone
        const dialChanged  = existing.dial_number !== dialNumber

        if (nameChanged || phoneChanged || dialChanged) {
          log(`[${site.slug}] Updating ${name} (unit ${dialNumber})`)
          debug(`  name: ${existing.name} → ${name}`)
          debug(`  phone: ${existing.phone} → ${phone}`)
          debug(`  dial: ${existing.dial_number} → ${dialNumber}`)

          if (!dryRun) {
            try {
              await unifi.upsertDirectoryEntry(
                site.unifi_controller_url, session,
                { id: resident.unifi_directory_id, name, dial_number: dialNumber, phone }
              )
              stats.updated++
            } catch (e) {
              err(`[${site.slug}] Failed to update ${name}:`, e)
              stats.error = e.message
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
        // New resident — create entry in UniFi
        log(`[${site.slug}] Adding ${name} (unit ${dialNumber}, ${phone})`)

        if (!dryRun) {
          try {
            const created = await unifi.upsertDirectoryEntry(
              site.unifi_controller_url, session,
              { name, dial_number: dialNumber, phone }
            )
            await supabase.setResidentUnifiId(resident.id, created.id)
            expectedUnifiIds.add(created.id)
            stats.added++
          } catch (e) {
            err(`[${site.slug}] Failed to add ${name}:`, e)
            stats.error = e.message
            stats.status = 'partial'
          }
        } else {
          log(`[${site.slug}] DRY-RUN: would add ${name}`)
          stats.added++
        }
      }
    }

    // 5. Delete UniFi entries that have no matching active resident
    for (const entry of unifiEntries) {
      if (expectedUnifiIds.has(entry.id)) continue

      log(`[${site.slug}] Removing stale entry: "${entry.name}" (${entry.dial_number})`)

      if (!dryRun) {
        try {
          await unifi.deleteDirectoryEntry(site.unifi_controller_url, session, entry.id)

          // Clear the unifi_directory_id from any inactive resident that still has this ID
          const { data: staleResident } = await supabase.db?.from('residents')
            .select('id')
            .eq('unifi_directory_id', entry.id)
            .maybeSingle() ?? {}
          if (staleResident) {
            await supabase.clearResidentUnifiId(staleResident.id)
          }

          stats.deleted++
        } catch (e) {
          err(`[${site.slug}] Failed to delete "${entry.name}":`, e)
          stats.error = e.message
          stats.status = 'partial'
        }
      } else {
        log(`[${site.slug}] DRY-RUN: would delete "${entry.name}"`)
        stats.deleted++
      }
    }

    // 6. Update site sync metadata
    if (!dryRun) {
      const finalCount = unifiEntries.length + stats.added - stats.deleted
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
    log(`[${site.slug}] Listing UniFi directory…`)
    try {
      const session = await unifi.login(
        site.unifi_controller_url,
        site.unifi_local_username,
        site.unifi_local_password
      )
      const entries = await unifi.listDirectoryEntries(site.unifi_controller_url, session)
      log(`[${site.slug}] ${entries.length} entries:`)
      entries.forEach(e => {
        console.log(`  [${e.dial_number}] ${e.name}  ${e.phone ?? '(no phone)'}  id=${e.id}`)
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
