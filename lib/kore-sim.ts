/**
 * KORE Wireless Super SIM API helper
 *
 * Background: Twilio's IoT/Super SIM business was acquired by KORE Wireless
 * in June 2023. The API architecture is nearly identical to Twilio's original
 * design but endpoints and auth have moved to KORE.
 *
 * Base URL:  https://supersim.api.korewireless.com/v1
 * Auth:      OAuth 2.0 Bearer token (NOT Twilio Basic Auth)
 * Token URL: https://api.korewireless.com/api-services/v1/auth/token
 *
 * Device APN config:
 *   APN:           super
 *   Username:      (blank)
 *   Password:      (blank)
 *   Data Roaming:  ENABLED (required — SIM uses multiple IMSIs)
 */

const KORE_BASE    = 'https://supersim.api.korewireless.com/v1'
const KORE_AUTH    = 'https://api.korewireless.com/api-services/v1/auth/token'

// ── Token cache ───────────────────────────────────────────────────────────────
let _cachedToken:   string | null = null
let _tokenExpiresAt: number       = 0

/**
 * Fetch (or return cached) KORE OAuth 2.0 access token.
 * Tokens expire in ~1 hour; we refresh 60s early.
 */
export async function getKoreToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 60_000) {
    return _cachedToken
  }

  const clientId     = process.env.KORE_CLIENT_ID
  const clientSecret = process.env.KORE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('KORE_CLIENT_ID and KORE_CLIENT_SECRET must be set')
  }

  const res = await fetch(KORE_AUTH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KORE auth failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  _cachedToken    = data.access_token as string
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000

  return _cachedToken
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type SimStatus = 'new' | 'ready' | 'active' | 'inactive' | 'scheduled'

export interface KoreSim {
  sid:          string    // HS...
  unique_name:  string
  status:       SimStatus
  iccid:        string
  fleet_sid:    string | null
  date_created: string
  date_updated: string
}

export interface ActivateSimOptions {
  /** SIM SID (HS...) or unique_name (e.g. ICCID) */
  simId:       string
  /** Fleet SID (HF...) to assign the SIM to */
  fleetSid:    string
  /**
   * Webhook URL to receive async activation result.
   * KORE returns 202 Accepted immediately; the final status
   * is delivered to this URL as a POST.
   */
  callbackUrl?: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Activate a Super SIM and assign it to a Fleet.
 * Returns 202 Accepted — poll getSim() or use callbackUrl for final status.
 */
export async function activateSim(opts: ActivateSimOptions): Promise<{ accepted: true; simId: string }> {
  const token = await getKoreToken()

  const body = new URLSearchParams({
    Fleet:  opts.fleetSid,
    Status: 'active',
  })
  if (opts.callbackUrl) {
    body.set('CallbackUrl',    opts.callbackUrl)
    body.set('CallbackMethod', 'POST')
  }

  const res = await fetch(`${KORE_BASE}/Sims/${opts.simId}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body,
  })

  if (res.status !== 202 && !res.ok) {
    const text = await res.text()
    throw new Error(`KORE activateSim failed ${res.status}: ${text}`)
  }

  return { accepted: true, simId: opts.simId }
}

/**
 * Deactivate a SIM (set status to 'inactive').
 */
export async function deactivateSim(simId: string): Promise<void> {
  const token = await getKoreToken()

  const res = await fetch(`${KORE_BASE}/Sims/${simId}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ Status: 'inactive' }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KORE deactivateSim failed ${res.status}: ${text}`)
  }
}

/**
 * Fetch current SIM status.
 */
export async function getSim(simId: string): Promise<KoreSim> {
  const token = await getKoreToken()

  const res = await fetch(`${KORE_BASE}/Sims/${simId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KORE getSim failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<KoreSim>
}

/**
 * List all SIMs in the account.
 */
export async function listSims(): Promise<KoreSim[]> {
  const token = await getKoreToken()

  const res = await fetch(`${KORE_BASE}/Sims`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KORE listSims failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  // KORE wraps list responses in a { sims: [...] } envelope
  return (data.sims ?? data) as KoreSim[]
}
