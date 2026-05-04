/**
 * agent/lib/unifi.js
 *
 * UniFi Access local controller client for the Pi sync agent.
 * Plain Node.js — no build step, no TypeScript.
 *
 * Confirmed endpoints (verified on-site via DevTools, May 2026):
 *   GET    /proxy/access/api/v2/callers/{templateId}/rooms          → list rooms
 *   POST   /proxy/access/api/v2/callers/{templateId}/rooms/receivers → create room
 *   DELETE /proxy/access/api/v2/callers/{templateId}/rooms/{roomId} → delete room
 *   (Update = delete + recreate — no PATCH/PUT endpoint found)
 *
 * Auth: POST /api/auth/login → session cookie + X-CSRF-Token header.
 * TLS:  self-signed certs accepted (LAN-only, never internet-facing).
 *
 * The templateId per site is stored in sites.unifi_template_id in Supabase.
 * Get it by running: GET /proxy/access/api/v2/templates on the controller.
 */

'use strict'

const https = require('https')

// Accept self-signed TLS certs — the UniFi controller uses them by default.
// This is safe because all calls stay on the property LAN (never leave the building).
const AGENT = new https.Agent({ rejectUnauthorized: false })

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

async function localFetch(url, options = {}) {
  return fetch(url, { ...options, agent: AGENT })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Login to the local UniFi Access controller.
 * Returns a session object with cookie and csrfToken.
 *
 * @param {string} controllerUrl  e.g. "https://192.168.26.33"
 * @param {string} username       Local admin username (NOT UI.com SSO)
 * @param {string} password       Local admin password
 * @returns {Promise<{cookie: string, csrfToken: string}>}
 */
async function login(controllerUrl, username, password) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/api/auth/login`

  const res = await localFetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password, rememberMe: false }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`UniFi login failed (${res.status}): ${text.slice(0, 200)}`)
  }

  // Extract session cookie and CSRF token from response headers
  const setCookie = res.headers.get('set-cookie') ?? ''
  const cookie    = setCookie.split(';')[0] ?? ''
  const csrfToken = res.headers.get('x-csrf-token') ?? ''

  if (!cookie) throw new Error('UniFi login: no session cookie returned')

  return { cookie, csrfToken }
}

// ─── Auth headers ─────────────────────────────────────────────────────────────

function authHeaders(session) {
  return {
    Accept:          'application/json',
    Cookie:          session.cookie,
    'X-CSRF-Token':  session.csrfToken,
  }
}

// ─── Directory API ────────────────────────────────────────────────────────────

/**
 * List all intercom directory rooms for a template.
 *
 * @param {string} controllerUrl
 * @param {object} session     From login()
 * @param {string} templateId  sites.unifi_template_id
 * @returns {Promise<Array<{id, name, room}>>}
 *   id   = UniFi room UUID (maps to residents.unifi_directory_id)
 *   name = display name shown on call box
 *   room = unit/dial number
 */
async function listDirectoryEntries(controllerUrl, session, templateId) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/${templateId}/rooms?page_num=1&page_size=1000`

  const res = await localFetch(url, { headers: authHeaders(session) })
  if (!res.ok) throw new Error(`listDirectoryEntries failed: ${res.status}`)

  const json = await res.json()
  const rooms = json?.data ?? []

  return rooms.map(r => ({
    id:   r.id,
    name: r.name  ?? '',
    room: r.room  ?? '',  // dial/unit number
  }))
}

/**
 * Create a new intercom directory room entry.
 *
 * @param {string} controllerUrl
 * @param {object} session     From login()
 * @param {string} templateId  sites.unifi_template_id
 * @param {object} entry       { name, room, phone }
 * @returns {Promise<{id, name, room}>}
 */
async function createDirectoryEntry(controllerUrl, session, templateId, { name, room, phone }) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/${templateId}/rooms/receivers`

  const payload = {
    name,
    room:              String(room ?? ''),
    disable_directory: false,
    number_check:      true,
    receiver_groups:   [{
      viewers:      [],
      admins:       [],
      chimes:       [],
      phone_numbers: phone ? [String(phone)] : [],
    }],
  }

  const res = await localFetch(url, {
    method:  'POST',
    headers: { ...authHeaders(session), 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`createDirectoryEntry failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  const d    = json?.data ?? json
  return { id: d.id, name: d.name, room: d.room }
}

/**
 * Delete an intercom directory room entry by its UniFi room ID.
 * 404s are silently ignored (already gone).
 *
 * @param {string} controllerUrl
 * @param {object} session     From login()
 * @param {string} templateId  sites.unifi_template_id
 * @param {string} roomId      The room's UniFi UUID
 */
async function deleteDirectoryEntry(controllerUrl, session, templateId, roomId) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/${templateId}/rooms/${roomId}`

  const res = await localFetch(url, {
    method:  'DELETE',
    headers: authHeaders(session),
  })

  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteDirectoryEntry failed: ${res.status}`)
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  login,
  listDirectoryEntries,
  createDirectoryEntry,
  deleteDirectoryEntry,
}
