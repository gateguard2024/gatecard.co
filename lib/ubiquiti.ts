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
