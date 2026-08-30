import 'server-only'
import { configured, requireEnv } from './env'

/**
 * Brivo — the roster in, credentials out.
 *
 * Gate Guard does not integrate with property management systems. Brivo does,
 * and already carries certified connectors to RealPage, Entrata, Yardi and Rent
 * Manager. Reading the roster from Brivo inherits all of them.
 *
 * What Brivo is NOT: a rent roll. It carries who gets access and when — name,
 * unit, move-in/move-out dates. It has no financial object, so nothing here can
 * post a charge or read a balance.
 *
 * Credentials are per-property: each property is its own Brivo account with its
 * own credential set, so every call takes them explicitly rather than reading a
 * single global account.
 */

const AUTH_URL = 'https://auth.brivo.com/oauth/token'
const API_URL = 'https://api.brivo.com/v1/api'

export interface BrivoCredentials {
  authBasic: string
  apiKey: string
  username: string
  password: string
}

export function envCredentials(): BrivoCredentials {
  if (!configured.brivo()) throw new Error('Brivo is not configured.')
  return {
    authBasic: requireEnv('BRIVO_AUTH_BASIC'),
    apiKey: requireEnv('BRIVO_API_KEY'),
    username: requireEnv('BRIVO_USERNAME'),
    password: requireEnv('BRIVO_PASSWORD'),
  }
}

export async function getToken(c: BrivoCredentials): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${c.authBasic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: c.username,
      password: c.password,
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Brivo auth failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Brivo auth returned no access_token')
  return json.access_token
}

export interface BrivoUser {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

/**
 * E.164, or null.
 *
 * Brivo hands back whatever the property typed. A number that can't be
 * normalised is dropped rather than guessed at — a wrong number on a resident
 * record means someone else's phone opens a gate.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  if (raw.trim().startsWith('+') && d.length >= 11 && d.length <= 15) return `+${d}`
  return null
}

/** Paginated roster read. Brivo caps pageSize at 100. */
export async function listUsers(
  c: BrivoCredentials,
  token: string,
): Promise<BrivoUser[]> {
  const out: BrivoUser[] = []
  const pageSize = 100

  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(`${API_URL}/users?pageSize=${pageSize}&offset=${offset}`, {
      headers: { Authorization: `bearer ${token}`, 'api-key': c.apiKey },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Brivo users failed: ${res.status}`)

    const json = (await res.json()) as {
      data?: {
        id: number
        firstName: string
        lastName: string
        email?: string
        phoneNumbers?: { number: string }[]
      }[]
    }
    const page = json.data ?? []
    for (const u of page) {
      out.push({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email ?? null,
        phone: toE164(u.phoneNumbers?.[0]?.number),
      })
    }
    if (page.length < pageSize) break
  }
  return out
}

/**
 * ASSUMPTION #1 in the handoff, and the highest-risk one in the whole design:
 * that the roster carries email and/or phone. Without one there is no magic
 * link and the entry point collapses to a QR code at key handover.
 *
 * Verify field-by-field against a live account before building on it. This
 * helper is what to run.
 */
export async function auditContactCoverage(c: BrivoCredentials) {
  const users = await listUsers(c, await getToken(c))
  const withEmail = users.filter(u => u.email).length
  const withPhone = users.filter(u => u.phone).length
  const withNeither = users.filter(u => !u.email && !u.phone).length
  return {
    total: users.length,
    withEmail,
    withPhone,
    withEither: users.filter(u => u.email || u.phone).length,
    withNeither,
    emailPct: users.length ? Math.round((withEmail / users.length) * 100) : 0,
    phonePct: users.length ? Math.round((withPhone / users.length) * 100) : 0,
  }
}
