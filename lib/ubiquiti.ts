/**
 * lib/ubiquiti.ts
 *
 * Two distinct APIs:
 *
 * 1. UniFi Site Manager API (cloud, read-only)
 *    Base: https://api.ui.com/v1/
 *    Auth: X-API-KEY header (from UBIQUITI_CLOUD_API_KEY env var)
 *    Use:  list hosts/sites/devices for monitoring
 *
 * 2. UniFi Access Local API (per-site controller, read+write)
 *    Base: https://<controller-ip>/proxy/access/api/v2/
 *    Auth: Authorization: Bearer <token>  (stored per-site in DB)
 *    Use:  unlock doors when resident presses 1 on IVR
 *
 * 3. UniFi Access Directory API (per-site controller, read+write)
 *    Base: https://<controller-ip>/proxy/access/api/v2/
 *    Auth: Session cookie + CSRF token from local login
 *    Use:  sync resident directory to intercom call box
 *    Note: Requires a LOCAL admin account — not UI.com SSO (avoids MFA issues)
 *    See:  loginToLocalController, listDirectoryEntries, upsertDirectoryEntry,
 *          deleteDirectoryEntry — called by the on-site Pi agent, not Vercel.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UiHost {
  id:           string
  type:         string
  owner:        boolean
  isBlocked:    boolean
  hardwareId:   string
  firmwareVersion: string
  reportedState: {
    hostname:   string
    ipAddresses: string[]
    online:     boolean
  }
}

export interface UiDevice {
  id:            string
  mac:           string
  ip:            string
  model:         string
  modelName:     string
  productLine:   string   // e.g. "access", "network", "protect"
  name:          string
  online:        boolean
  firmwareVersion: string
  hostId:        string
  siteId:        string
}

export interface AccessDeviceStatus {
  device_id:   string
  door_lock_relay_status: 'lock' | 'unlock'
  online:      boolean
  name:        string
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud: Site Manager API helpers (read-only)
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_BASE = 'https://api.ui.com/v1'

function cloudHeaders() {
  const key = process.env.UBIQUITI_CLOUD_API_KEY
  if (!key) throw new Error('UBIQUITI_CLOUD_API_KEY not configured')
  return {
    'X-API-KEY': key,
    'Accept':    'application/json',
  }
}

/** List all UniFi hosts (consoles) linked to the account */
export async function listHosts(): Promise<UiHost[]> {
  const res = await fetch(`${CLOUD_BASE}/hosts`, { headers: cloudHeaders() })
  if (!res.ok) throw new Error(`listHosts failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

/** List all sites across all hosts */
export async function listCloudSites(): Promise<unknown[]> {
  const res = await fetch(`${CLOUD_BASE}/sites`, { headers: cloudHeaders() })
  if (!res.ok) throw new Error(`listCloudSites failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

/** List all devices — optionally filter by hostIds */
export async function listCloudDevices(hostIds?: string[]): Promise<UiDevice[]> {
  const url = new URL(`${CLOUD_BASE}/devices`)
  if (hostIds?.length) url.searchParams.set('hostIds', hostIds.join(','))
  const res = await fetch(url.toString(), { headers: cloudHeaders() })
  if (!res.ok) throw new Error(`listCloudDevices failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Local: UniFi Access controller API (per-site, read+write)
//
// Local UniFi controllers use self-signed TLS certs by default.
// Set UBIQUITI_ALLOW_SELF_SIGNED=true in Vercel env vars to bypass cert
// verification for on-prem controllers (safe — these are LAN-only calls
// routed via VPN/Tailscale, never over the public internet).
// ─────────────────────────────────────────────────────────────────────────────

import https from 'https'

/** Build a Node https.Agent that optionally skips TLS cert verification */
function localAgent(): https.Agent {
  const allowSelfSigned = process.env.UBIQUITI_ALLOW_SELF_SIGNED === 'true'
  return new https.Agent({ rejectUnauthorized: !allowSelfSigned })
}

/** fetch() wrapper that injects the https agent for local controller calls */
function localFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, agent: localAgent() } as unknown as RequestInit)
}

/**
 * Unlock a door via the local UniFi Access controller.
 *
 * @param controllerUrl  Base URL of the local controller, e.g. "https://192.168.1.1"
 * @param token          Bearer token from the local controller
 * @param doorId         UniFi Access device ID (the door/gate)
 * @param durationMs     How long to hold it unlocked (ms). Default: 3000 (3 s)
 */
export async function unlockDoor(
  controllerUrl: string,
  token: string,
  doorId: string,
  durationMs = 3000
): Promise<void> {
  const url = `${controllerUrl.replace(/\/$/, '')}/proxy/access/api/v2/device/${doorId}/unlocksync`

  const res = await localFetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ duration: durationMs }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`unlockDoor failed: ${res.status} ${text}`)
  }
}

/**
 * Get current status of a door device.
 */
export async function getDoorStatus(
  controllerUrl: string,
  token: string,
  doorId: string
): Promise<AccessDeviceStatus> {
  const url = `${controllerUrl.replace(/\/$/, '')}/proxy/access/api/v2/device/${doorId}`

  const res = await localFetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
    },
  })

  if (!res.ok) throw new Error(`getDoorStatus failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? json
}

/**
 * List all Access devices on the local controller.
 */
export async function listLocalDevices(
  controllerUrl: string,
  token: string
): Promise<AccessDeviceStatus[]> {
  const url = `${controllerUrl.replace(/\/$/, '')}/proxy/access/api/v2/device`

  const res = await localFetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
    },
  })

  if (!res.ok) throw new Error(`listLocalDevices failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Local: UniFi Access Intercom Directory Management
//
// These functions sync the resident list from Supabase into the UniFi Access
// intercom directory — the names visitors see and tap on the call box screen.
//
// Auth:
//   POST {controllerUrl}/api/auth/login
//   Body: { username, password, rememberMe: false }
//   Returns session cookie (TOKEN=...) + X-CSRF-Token header.
//   Some firmware versions also return an authToken in the JSON body.
//   We carry all three so it works across firmware versions.
//
// Directory endpoints (internal API — same one the Access web UI uses):
//   GET    /proxy/access/api/v2/user           → list all directory entries
//   POST   /proxy/access/api/v2/user           → create entry
//   PUT    /proxy/access/api/v2/user/{id}      → update entry
//   DELETE /proxy/access/api/v2/user/{id}      → remove entry
//
// ⚠ TODO (confirm on-site): verify exact POST/PUT request body shape via
//   browser DevTools → Network tab when adding an entry in the Access UI.
//   Expected shape based on community Python import script:
//     { name: string, dial_number: string, phone_numbers: [{ phone: string }] }
//   Update UNIFI_PAYLOAD_TODO marker below once confirmed.
//
// Called by: agent/sync-agent.js (on-site Pi) — NOT Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectoryEntry {
  id:          string   // UniFi internal ID — stored in residents.unifi_directory_id
  name:        string   // Display name shown on call box, e.g. "Smith, J."
  dial_number: string   // Room/unit code visitor can dial, e.g. "0101"
  phone:       string | null  // E.164 phone number called when visitor selects entry
}

export interface UniFiSession {
  cookie:     string   // Raw Set-Cookie value (TOKEN=...)
  csrfToken:  string   // X-CSRF-Token header value
  authToken:  string   // JWT from response body (some firmware versions)
}

/**
 * Authenticate to the local UniFi Access controller.
 * Use a LOCAL admin account — not your UI.com SSO account (which requires MFA).
 * Create one in: UniFi OS → Settings → Admins & Users → Add Admin → Local Access Only
 */
export async function loginToLocalController(
  controllerUrl: string,
  username: string,
  password: string
): Promise<UniFiSession> {
  const base = controllerUrl.replace(/\/$/, '')

  const res = await localFetch(`${base}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password, rememberMe: false }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`UniFi local login failed (${res.status}): ${text.slice(0, 200)}`)
  }

  // Cookie: may be TOKEN=... or unifises=... depending on firmware
  const setCookie = res.headers.get('set-cookie') ?? ''
  const cookie    = setCookie.split(';')[0] ?? ''
  const csrfToken = res.headers.get('x-csrf-token') ?? ''

  // Some firmware versions return the token in the JSON body
  let authToken = ''
  try {
    const json = await res.json() as any
    authToken = json?.data?.authToken ?? json?.token ?? ''
  } catch { /* ignore — cookie auth is sufficient */ }

  return { cookie, csrfToken, authToken }
}

/** Build auth headers from a UniFiSession — works across firmware versions */
function directoryAuthHeaders(session: UniFiSession): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (session.cookie)    headers['Cookie']        = session.cookie
  if (session.csrfToken) headers['X-CSRF-Token']  = session.csrfToken
  if (session.authToken) headers['Authorization'] = `Bearer ${session.authToken}`
  return headers
}

/** Normalize raw UniFi user object to our DirectoryEntry shape */
function normalizeEntry(raw: any): DirectoryEntry {
  const phones: any[] = raw?.phone_numbers ?? raw?.phones ?? []
  return {
    id:          String(raw?.id ?? raw?._id ?? ''),
    name:        raw?.name ?? '',
    dial_number: String(raw?.dial_number ?? raw?.dialNumber ?? raw?.room ?? ''),
    phone:       phones[0]?.phone ?? phones[0]?.number ?? raw?.phone ?? null,
  }
}

/** List all current intercom directory entries on the local controller */
export async function listDirectoryEntries(
  controllerUrl: string,
  session: UniFiSession
): Promise<DirectoryEntry[]> {
  const base = controllerUrl.replace(/\/$/, '')

  const res = await localFetch(`${base}/proxy/access/api/v2/user`, {
    headers: directoryAuthHeaders(session),
  })

  if (!res.ok) throw new Error(`listDirectoryEntries failed: ${res.status}`)
  const json = await res.json() as any
  const raw: any[] = json?.data ?? json ?? []
  return raw.map(normalizeEntry)
}

/**
 * Create or update an intercom directory entry.
 * Pass entry.id to update an existing entry — omit/leave empty to create new.
 *
 * ⚠ UNIFI_PAYLOAD_TODO: Confirm exact body shape on-site via DevTools.
 * Current shape is based on the community Python bulk-import script.
 */
export async function upsertDirectoryEntry(
  controllerUrl: string,
  session: UniFiSession,
  entry: { id?: string; name: string; dial_number: string; phone: string | null }
): Promise<DirectoryEntry> {
  const base  = controllerUrl.replace(/\/$/, '')
  const isNew = !entry.id
  const url   = isNew
    ? `${base}/proxy/access/api/v2/user`
    : `${base}/proxy/access/api/v2/user/${entry.id}`

  // ⚠ UNIFI_PAYLOAD_TODO: verify field names on-site
  const payload = {
    name:          entry.name,
    dial_number:   entry.dial_number,
    phone_numbers: entry.phone ? [{ phone: entry.phone }] : [],
  }

  const res = await localFetch(url, {
    method:  isNew ? 'POST' : 'PUT',
    headers: { ...directoryAuthHeaders(session), 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upsertDirectoryEntry failed (${res.status}): ${text.slice(0, 300)}`)
  }

  const json = await res.json() as any
  return normalizeEntry(json?.data ?? json)
}

/**
 * Delete an intercom directory entry by its UniFi ID.
 * Safe to call with a stale ID — 404 responses are silently ignored.
 */
export async function deleteDirectoryEntry(
  controllerUrl: string,
  session: UniFiSession,
  unifiId: string
): Promise<void> {
  const base = controllerUrl.replace(/\/$/, '')

  const res = await localFetch(`${base}/proxy/access/api/v2/user/${unifiId}`, {
    method:  'DELETE',
    headers: directoryAuthHeaders(session),
  })

  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteDirectoryEntry failed: ${res.status}`)
  }
}
