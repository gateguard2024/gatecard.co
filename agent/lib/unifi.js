/**
 * agent/lib/unifi.js
 *
 * UniFi Access local controller client for the Pi sync agent.
 * Plain Node.js — no build step, no TypeScript.
 *
 * Confirmed endpoints (reverse-engineered from browser captures, May 2026):
 *   GET    /proxy/access/api/v2/callers/phone_number                 → list all phone numbers (global)
 *   PUT    /proxy/access/api/v2/callers/phone_number                 → upsert phone numbers (full list replace)
 *   GET    /proxy/access/api/v2/callers/{templateId}/rooms           → list directory rooms
 *   POST   /proxy/access/api/v2/callers/{templateId}/rooms/receivers → create room
 *   DELETE /proxy/access/api/v2/callers/{templateId}/rooms/{roomId}  → delete room
 *   (Update = delete + recreate — no PATCH/PUT endpoint exists)
 *
 * IMPORTANT — how phone numbers work:
 *   Phone numbers are stored in a GLOBAL list on the controller, not per room.
 *   Directory entries reference phones by unique_id, not by number string.
 *   Workflow:
 *     1. GET /callers/phone_number  → existing [{unique_id, country_code, area_code, phone_number}]
 *     2. PUT /callers/phone_number  → full list including new entries → returns updated list with unique_ids
 *     3. POST .../rooms/receivers   → receiver_groups[0].phone_numbers = [unique_id]  ← NOT a number string
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
// Uses https.request directly so the custom agent (self-signed cert bypass)
// is honoured — Node 18's global fetch silently ignores the `agent` option.

function localFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const method  = options.method ?? 'GET'
    const headers = options.headers ?? {}
    const body    = options.body ?? null

    const req = https.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || 443,
        path:     parsed.pathname + parsed.search,
        method,
        headers,
        agent:    AGENT,
      },
      (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve({
            ok:     res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: { get: (name) => res.headers[name.toLowerCase()] ?? null },
            text:   () => Promise.resolve(raw),
            json:   () => Promise.resolve(JSON.parse(raw)),
          })
        })
      }
    )

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
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

  // Extract session cookie and CSRF token from response headers.
  // Node.js http returns set-cookie as an array (multiple headers allowed),
  // so normalize to a string before splitting.
  const setCookieRaw = res.headers.get('set-cookie') ?? ''
  const setCookie    = Array.isArray(setCookieRaw) ? (setCookieRaw[0] ?? '') : setCookieRaw
  const cookie       = setCookie.split(';')[0] ?? ''
  const csrfToken    = res.headers.get('x-csrf-token') ?? ''

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

// ─── Phone Number API ─────────────────────────────────────────────────────────
// Phone numbers are a global list on the controller — not scoped to a template.
// Directory entries reference phones by unique_id.

/**
 * Normalize an E.164 phone string to last-10-digits for deduplication.
 * "+14045550199" → "4045550199"
 */
function phoneToTen(raw) {
  return raw.replace(/\D/g, '').slice(-10)
}

/**
 * Convert an E.164 string to the format UniFi's phone_number API expects.
 * "+14045550199" → { country_code: "US", area_code: "+1", phone_number: "(404) 555-0199" }
 * Returns null if the number can't be parsed as a 10-digit US number.
 */
function e164ToUniFiPhone(e164) {
  const digits = e164.replace(/\D/g, '')
  let local = digits
  if (digits.length === 11 && digits.startsWith('1')) local = digits.slice(1)
  if (local.length !== 10) return null
  const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  return { country_code: 'US', area_code: '+1', phone_number: formatted }
}

/**
 * Fetch all phone numbers currently registered on the controller.
 * Returns array of { unique_id, country_code, area_code, phone_number }.
 *
 * @param {string} controllerUrl
 * @param {object} session  From login()
 * @returns {Promise<Array<{unique_id, country_code, area_code, phone_number}>>}
 */
async function getPhoneNumbers(controllerUrl, session) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/phone_number`

  const res = await localFetch(url, { headers: authHeaders(session) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`getPhoneNumbers failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  return json?.data ?? []
}

/**
 * Ensure a set of E.164 phone numbers exist in the controller's global list.
 * Any numbers not already present are appended and the full list is PUT back.
 * Returns the updated list (with unique_ids for all entries).
 *
 * @param {string}   controllerUrl
 * @param {object}   session       From login()
 * @param {string[]} e164Phones    E.164 numbers to ensure exist (e.g. ["+14045550199"])
 * @param {Array}    existingPhones  Current phone list from getPhoneNumbers()
 * @returns {Promise<Array<{unique_id, country_code, area_code, phone_number}>>}
 */
async function upsertPhoneNumbers(controllerUrl, session, e164Phones, existingPhones) {
  // Build lookup: last-10-digits → existing record
  const byTen = new Map(existingPhones.map(p => [
    phoneToTen(p.area_code + p.phone_number), p,
  ]))

  // Start with the full existing list (must be included in PUT — it's a full replace)
  const payload = existingPhones.map(p => ({
    unique_id:    p.unique_id,
    country_code: p.country_code ?? 'US',
    area_code:    p.area_code    ?? '+1',
    phone_number: p.phone_number ?? '',
  }))

  let added = 0
  for (const e164 of e164Phones) {
    const ten = phoneToTen(e164)
    if (!byTen.has(ten)) {
      const formatted = e164ToUniFiPhone(e164)
      if (formatted) {
        payload.push({ unique_id: '', ...formatted })
        added++
      }
    }
  }

  if (added === 0) return existingPhones  // nothing to do

  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/phone_number`

  const res = await localFetch(url, {
    method:  'PUT',
    headers: { ...authHeaders(session), 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upsertPhoneNumbers failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  return json?.data ?? []
}

/**
 * Find the unique_id for an E.164 phone in the controller's phone list.
 * Returns null if not found.
 *
 * @param {string} e164        E.164 phone string
 * @param {Array}  phoneRecords  From getPhoneNumbers() or upsertPhoneNumbers()
 * @returns {string|null}
 */
function findPhoneUniqueId(e164, phoneRecords) {
  const ten = phoneToTen(e164)
  for (const p of phoneRecords) {
    if (phoneToTen(p.area_code + p.phone_number) === ten) return p.unique_id
  }
  return null
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
 * @param {object} session       From login()
 * @param {string} templateId    sites.unifi_template_id
 * @param {object} entry         { name, room, phoneUniqueId }
 *   phoneUniqueId = unique_id from the global phone list (NOT a raw phone string).
 *   Call upsertPhoneNumbers() first to get this id.
 * @returns {Promise<{id, name, room}>}
 */
async function createDirectoryEntry(controllerUrl, session, templateId, { name, room, phoneUniqueId }) {
  const base = controllerUrl.replace(/\/$/, '')
  const url  = `${base}/proxy/access/api/v2/callers/${templateId}/rooms/receivers`

  const payload = {
    name,
    room:              String(room ?? ''),
    disable_directory: false,
    number_check:      true,
    receiver_groups:   [{
      viewers:           [],
      admins:            [],
      chimes:            [],
      phone_numbers:     phoneUniqueId ? [phoneUniqueId] : [],
      third_party_sips:  [],
      third_party_viewers: [],
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
  getPhoneNumbers,
  upsertPhoneNumbers,
  findPhoneUniqueId,
  listDirectoryEntries,
  createDirectoryEntry,
  deleteDirectoryEntry,
}
