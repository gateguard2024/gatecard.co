/**
 * agent/lib/unifi.js
 *
 * UniFi Access local controller client for the Pi sync agent.
 * Plain Node.js — no build step, no TypeScript.
 *
 * Auth: local admin account on the controller (not UI.com SSO).
 * TLS:  self-signed certs accepted (LAN-only, never internet-facing).
 *
 * ⚠ UNIFI_PAYLOAD_TODO: Confirm POST/PUT body shape on-site via DevTools.
 *   See upsertDirectoryEntry() below.
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
 * Returns a session object with cookie, csrfToken, and authToken.
 *
 * @param {string} controllerUrl  e.g. "https://192.168.1.1"
 * @param {string} username       Local admin username (NOT UI.com SSO)
 * @param {string} password       Local admin password
 * @returns {Promise<{cookie: string, csrfToken: string, authToken: string}>}
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

  // Extract cookie + CSRF token
  const setCookie = res.headers.get('set-cookie') ?? ''
  const cookie    = setCookie.split(';')[0] ?? ''
  const csrfToken = res.headers.get('x-csrf-token') ?? ''

  // Some firmware returns authToken in JSON body
  let authToken = ''
  try {
    const json = await res.json()
    authToken = json?.data?.authToken ?? json?.token ?? ''
  } catch { /* cookie auth is sufficient */ }

  return { cookie, csrfToken, authToken }
}

// ─── Auth headers ─────────────────────────────────────────────────────────────

function authHeaders(session) {
  const headers = { Accept: 'application/json' }
  if (session.cookie)    headers['Cookie']        = session.cookie
  if (session.csrfToken) headers['X-CSRF-Token']  = session.csrfToken
  if (session.authToken) headers['Authorization'] = `Bearer ${session.authToken}`
  return headers
}

// ─── Directory entry normalizer ───────────────────────────────────────────────

function normalize(raw) {
  const phones = raw?.phone_numbers ?? raw?.phones ?? []
  return {
    id:          String(raw?.id ?? raw?._id ?? ''),
    name:        raw?.name ?? '',
    dial_number: String(raw?.dial_number ?? raw?.dialNumber ?? raw?.room ?? ''),
    phone:       phones[0]?.phone ?? phones[0]?.number ?? raw?.phone ?? null,
  }
}

// ─── Directory API ────────────────────────────────────────────────────────────

/**
 * List all current intercom directory entries.
 *
 * @param {string} controllerUrl
 * @param {object} session  From login()
 * @returns {Promise<Array<{id, name, dial_number, phone}>>}
 */
async function listDirectoryEntries(controllerUrl, session) {
  const url = `${controllerUrl.replace(/\/$/, '')}/proxy/access/api/v2/user`

  const res = await localFetch(url, { headers: authHeaders(session) })

  if (!res.ok) throw new Error(`listDirectoryEntries failed: ${res.status}`)
  const json = await res.json()
  const raw  = json?.data ?? json ?? []
  return Array.isArray(raw) ? raw.map(normalize) : []
}

/**
 * Create or update a directory entry.
 *
 * @param {string} controllerUrl
 * @param {object} session         From login()
 * @param {object} entry           { id?, name, dial_number, phone }
 *   - Omit id to create new; provide id to update existing.
 *
 * ⚠ UNIFI_PAYLOAD_TODO:
 *   Confirm exact field names on-site by watching DevTools Network tab while
 *   adding/editing a directory entry in the UniFi Access web UI.
 *   Current shape is based on the community Python bulk-import script.
 *   Fields to verify: name, dial_number, phone_numbers[].phone
 *
 * @returns {Promise<{id, name, dial_number, phone}>}
 */
async function upsertDirectoryEntry(controllerUrl, session, entry) {
  const base  = controllerUrl.replace(/\/$/, '')
  const isNew = !entry.id
  const url   = isNew
    ? `${base}/proxy/access/api/v2/user`
    : `${base}/proxy/access/api/v2/user/${entry.id}`

  // ⚠ UNIFI_PAYLOAD_TODO: verify these field names on-site
  const payload = {
    name:          entry.name,
    dial_number:   entry.dial_number,
    phone_numbers: entry.phone ? [{ phone: entry.phone }] : [],
  }

  const res = await localFetch(url, {
    method:  isNew ? 'POST' : 'PUT',
    headers: { ...authHeaders(session), 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upsertDirectoryEntry failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  return normalize(json?.data ?? json)
}

/**
 * Delete a directory entry by its UniFi ID.
 * 404s are silently ignored (already gone).
 *
 * @param {string} controllerUrl
 * @param {object} session  From login()
 * @param {string} unifiId
 */
async function deleteDirectoryEntry(controllerUrl, session, unifiId) {
  const url = `${controllerUrl.replace(/\/$/, '')}/proxy/access/api/v2/user/${unifiId}`

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
  upsertDirectoryEntry,
  deleteDirectoryEntry,
}
