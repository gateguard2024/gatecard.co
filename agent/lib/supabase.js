/**
 * agent/lib/supabase.js
 *
 * Supabase client helpers for the Pi sync agent.
 * Uses the service role key — full DB access, no RLS restrictions.
 * Keep SUPABASE_SERVICE_ROLE_KEY secret and out of version control.
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')

let _client = null

function db() {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    }

    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _client
}

/**
 * Fetch all active sites that have a UniFi local controller configured.
 *
 * @param {string|null} siteSlug  Optional — restrict to one site
 * @returns {Promise<Array>}
 */
async function getActiveSites(siteSlug = null) {
  let query = db()
    .from('sites')
    .select('id, slug, name, unifi_controller_url, unifi_local_username, unifi_local_password, unifi_template_id')
    .eq('active', true)
    .not('unifi_controller_url', 'is', null)
    .not('unifi_local_username', 'is', null)
    .not('unifi_local_password', 'is', null)

  if (siteSlug) query = query.eq('slug', siteSlug)

  const { data, error } = await query
  if (error) throw new Error(`getActiveSites failed: ${error.message}`)
  return data ?? []
}

/**
 * Fetch all active residents for a site, with their UniFi directory mapping.
 * Includes pinned entries (leasing office, EMS, etc.) even if they have no phone.
 *
 * @param {string} siteId
 * @returns {Promise<Array<{id, display_name, unit_number, phone, unifi_directory_id, pinned}>>}
 */
async function getActiveResidents(siteId) {
  const { data, error } = await db()
    .from('residents')
    .select('id, display_name, unit_number, phone, unifi_directory_id, pinned')
    .eq('site_id', siteId)
    .eq('active', true)
    .not('phone', 'is', null)   // Only sync residents with a phone number
    .order('unit_number', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`getActiveResidents failed: ${error.message}`)
  return data ?? []
}

/**
 * Fetch all active PINNED residents for a site (regardless of phone).
 * Used to protect leasing office / EMS entries from deletion.
 *
 * @param {string} siteId
 * @returns {Promise<Array<{id, display_name, unit_number, phone, unifi_directory_id, pinned}>>}
 */
async function getPinnedResidents(siteId) {
  const { data, error } = await db()
    .from('residents')
    .select('id, display_name, unit_number, phone, unifi_directory_id, pinned')
    .eq('site_id', siteId)
    .eq('active', true)
    .eq('pinned', true)

  if (error) throw new Error(`getPinnedResidents failed: ${error.message}`)
  return data ?? []
}

/**
 * Store the UniFi directory ID back on a resident row after creating an entry.
 *
 * @param {string} residentId
 * @param {string} unifiDirectoryId
 */
async function setResidentUnifiId(residentId, unifiDirectoryId) {
  const { error } = await db()
    .from('residents')
    .update({ unifi_directory_id: unifiDirectoryId })
    .eq('id', residentId)

  if (error) throw new Error(`setResidentUnifiId failed: ${error.message}`)
}

/**
 * Clear the UniFi directory ID from a resident (after deleting their entry).
 *
 * @param {string} residentId
 */
async function clearResidentUnifiId(residentId) {
  const { error } = await db()
    .from('residents')
    .update({ unifi_directory_id: null })
    .eq('id', residentId)

  if (error) throw new Error(`clearResidentUnifiId failed: ${error.message}`)
}

/**
 * Update the site's last sync timestamp and contact count.
 *
 * @param {string} siteId
 * @param {number} contactCount
 */
async function updateSiteSyncStatus(siteId, contactCount) {
  const { error } = await db()
    .from('sites')
    .update({
      unifi_last_contact_sync: new Date().toISOString(),
      unifi_contact_count:     contactCount,
    })
    .eq('id', siteId)

  if (error) throw new Error(`updateSiteSyncStatus failed: ${error.message}`)
}

/**
 * Write a sync run result to the audit log.
 *
 * @param {string} siteId
 * @param {object} result  { added, updated, deleted, skipped, durationMs, error, status }
 */
async function writeSyncLog(siteId, result) {
  const { error } = await db()
    .from('unifi_sync_log')
    .insert({
      site_id:     siteId,
      ran_at:      new Date().toISOString(),
      duration_ms: result.durationMs ?? null,
      added:       result.added   ?? 0,
      updated:     result.updated ?? 0,
      deleted:     result.deleted ?? 0,
      skipped:     result.skipped ?? 0,
      error:       result.error   ?? null,
      status:      result.status  ?? 'ok',
    })

  if (error) {
    // Don't throw — a log write failure shouldn't crash the sync
    console.error('[supabase] writeSyncLog failed:', error.message)
  }
}

module.exports = {
  getActiveSites,
  getActiveResidents,
  getPinnedResidents,
  setResidentUnifiId,
  clearResidentUnifiId,
  updateSiteSyncStatus,
  writeSyncLog,
}
