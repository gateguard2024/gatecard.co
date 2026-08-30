import 'server-only'
import { getToken, type BrivoCredentials } from './brivo'
import { supabaseAdmin } from './supabase'

/**
 * Resolving a resident's UNIT from Brivo.
 *
 * ⚠️  Naming: our `sites` table is a PROPERTY (East Ponds). A Brivo "site" is a
 *     UNIT (214). Everything here says `unitSite` so the two can never be
 *     confused at a glance.
 *
 * Brivo has no user→site edge. Access runs:
 *
 *     user ──< membership >── group ──< permission >── site (the unit)
 *
 * So the map is built group-first: list groups, work out which unit each group
 * belongs to, then list that group's members. ~300 requests for an 832-resident
 * property instead of 832, and it's the direction the API actually supports.
 *
 * The hard part isn't fetching — it's telling a unit from an amenity. Residents
 * also have access to the vehicle gate, the clubhouse, the pool and the package
 * room, all of which are Brivo sites too. Without a rule, every resident
 * "lives in" the Main Gate.
 */

const API = 'https://api.brivo.com/v1/api'

export type UnitSource = 'brivo_site' | 'group' | 'custom_field'

export interface TopologyConfig {
  source: UnitSource
  /** A unit name matches this, e.g. '^[0-9]{1,5}[A-Za-z]?$'. */
  pattern: string | null
  /** Names that are never units, whatever the pattern says. */
  exclude: string[]
}

export interface UnitMap {
  /** brivoUserId → unit label */
  map: Record<string, string>
  unitNames: string[]
  excludedNames: string[]
  /** Users that matched more than one unit-like name. Flagged, never guessed. */
  ambiguous: Record<string, string[]>
  groupsScanned: number
  complete: boolean
  error?: string
}

interface BrivoNamed { id: number | string; name?: string; siteName?: string; siteId?: number | string }

async function page<T>(
  url: string, token: string, apiKey: string,
): Promise<{ items: T[]; ok: boolean; error?: string }> {
  const items: T[] = []
  const size = 100
  for (let offset = 0; ; offset += size) {
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}pageSize=${size}&offset=${offset}`, {
      headers: { Authorization: `bearer ${token}`, 'api-key': apiKey.trim() },
      cache: 'no-store',
    })
    if (!res.ok) return { items, ok: false, error: `${res.status} on ${url}` }

    const json = (await res.json()) as Record<string, unknown>
    const chunk = (json.data ?? json.groups ?? json.sites ?? json.users ?? json.results ?? []) as T[]
    if (!Array.isArray(chunk)) return { items, ok: false, error: `Unrecognised shape from ${url}` }

    items.push(...chunk)
    if (chunk.length < size) return { items, ok: true }
    if (offset > 20_000) return { items, ok: false, error: `Pagination did not terminate on ${url}` }
  }
}

/**
 * Is this name a unit, or is it the pool?
 *
 * With no pattern configured, fall back to "looks like a unit number" —
 * digits with an optional letter. That is a guess, and it is recorded as one:
 * the probe endpoint shows exactly what got classified either way so the
 * pattern can be set from real names instead of hope.
 */
const DEFAULT_UNIT_RE = /^[0-9]{1,5}[A-Za-z]?$/

export function isUnitName(name: string, cfg: TopologyConfig): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (cfg.exclude.some(x => x.toLowerCase() === trimmed.toLowerCase())) return false
  const re = cfg.pattern ? new RegExp(cfg.pattern) : DEFAULT_UNIT_RE
  return re.test(trimmed)
}

export async function buildUnitMap(
  creds: BrivoCredentials,
  cfg: TopologyConfig,
): Promise<UnitMap> {
  const out: UnitMap = {
    map: {}, unitNames: [], excludedNames: [], ambiguous: {},
    groupsScanned: 0, complete: false,
  }

  let token: string
  try {
    token = await getToken(creds)
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err)
    return out
  }

  // Brivo sites, i.e. the units (plus the gate, the pool, the clubhouse...).
  const sites = await page<BrivoNamed>(`${API}/sites`, token, creds.apiKey)
  const siteName = new Map<string, string>()
  for (const s of sites.items) if (s.name) siteName.set(String(s.id), s.name)

  const groups = await page<BrivoNamed>(`${API}/groups`, token, creds.apiKey)
  if (!groups.ok) {
    out.error = groups.error
    return out
  }

  const seen = new Set<string>()
  const excluded = new Set<string>()
  const candidates = new Map<string, Set<string>>() // userId → unit names

  for (const g of groups.items) {
    // Where the unit label comes from depends on how the account is modelled.
    const label =
      cfg.source === 'group'
        ? (g.name ?? '')
        : (g.siteId ? siteName.get(String(g.siteId)) ?? '' : g.siteName ?? g.name ?? '')

    if (!label) continue

    if (!isUnitName(label, cfg)) {
      excluded.add(label)
      // An amenity group. Skip it — fetching its members would map every
      // resident in the building to "Clubhouse".
      continue
    }
    seen.add(label)

    const members = await page<{ id: number | string }>(
      `${API}/groups/${g.id}/users`, token, creds.apiKey)
    out.groupsScanned += 1

    // One group failing must not silently produce a half-map that then looks
    // like a lot of residents changing unit.
    if (!members.ok) {
      out.error = members.error
      out.unitNames = [...seen]
      out.excludedNames = [...excluded]
      return out
    }

    for (const m of members.items) {
      const uid = String(m.id)
      if (!candidates.has(uid)) candidates.set(uid, new Set())
      candidates.get(uid)!.add(label)
    }
  }

  for (const [uid, labels] of candidates) {
    const list = [...labels]
    if (list.length === 1) {
      out.map[uid] = list[0]
    } else {
      // Two unit-like names for one person: a roommate on two leases, a stale
      // permission from a previous unit, or a pattern that is too loose. All
      // three need a human, so none of them get a guessed unit.
      out.ambiguous[uid] = list
    }
  }

  out.unitNames = [...seen].sort()
  out.excludedNames = [...excluded].sort()
  out.complete = true
  return out
}

/**
 * Cached lookup.
 *
 * Topology changes rarely; the roster changes constantly. But a brand-new
 * resident is always absent from the cache, and waiting out the TTL to learn
 * their unit would delay every move-in — so an unmapped id forces a rebuild.
 */
export async function getUnitMap(args: {
  propertySiteId: string
  creds: BrivoCredentials
  cfg: TopologyConfig
  ttlMinutes: number
  expectUserIds?: string[]
}): Promise<UnitMap & { fromCache: boolean }> {
  const db = supabaseAdmin()

  const { data: cached } = await db
    .from('brivo_unit_map_cache')
    .select('unit_map, unit_names, excluded_names, ambiguous, groups_scanned, built_at')
    .eq('site_id', args.propertySiteId)
    .maybeSingle()
    .returns<{
      unit_map: Record<string, string>
      unit_names: string[]
      excluded_names: string[]
      ambiguous: Record<string, string[]>
      groups_scanned: number
      built_at: string
    }>()

  const fresh = cached
    && (Date.now() - new Date(cached.built_at).getTime()) < args.ttlMinutes * 60_000

  const missing = args.expectUserIds?.some(
    id => !(id in (cached?.unit_map ?? {})) && !(id in (cached?.ambiguous ?? {})))

  if (cached && fresh && !missing) {
    return {
      map: cached.unit_map, unitNames: cached.unit_names,
      excludedNames: cached.excluded_names, ambiguous: cached.ambiguous,
      groupsScanned: cached.groups_scanned, complete: true, fromCache: true,
    }
  }

  const built = await buildUnitMap(args.creds, args.cfg)

  // A failed rebuild must not throw away a good cache. Serve the stale map and
  // report the error — a slightly old unit is far better than none.
  if (!built.complete && cached) {
    return {
      map: cached.unit_map, unitNames: cached.unit_names,
      excludedNames: cached.excluded_names, ambiguous: cached.ambiguous,
      groupsScanned: cached.groups_scanned,
      complete: false, error: built.error, fromCache: true,
    }
  }

  if (built.complete) {
    await db.from('brivo_unit_map_cache').upsert({
      site_id: args.propertySiteId,
      unit_map: built.map,
      unit_names: built.unitNames,
      excluded_names: built.excludedNames,
      ambiguous: built.ambiguous,
      groups_scanned: built.groupsScanned,
      built_at: new Date().toISOString(),
      error: null,
    }, { onConflict: 'site_id' })
  }

  return { ...built, fromCache: false }
}
