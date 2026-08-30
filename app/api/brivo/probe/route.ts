import { NextResponse, type NextRequest } from 'next/server'
import { configured } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'
import { buildUnitMap, isUnitName, type UnitSource } from '@/lib/brivo-topology'
import { getToken } from '@/lib/brivo'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * What does this Brivo account actually look like?
 *
 * The handoff's own instruction: verify field-by-field against a live account,
 * not against the docs. This is that check, and it is read-only — it writes
 * nothing and touches no resident.
 *
 * Run it before enabling sync at a new property. It answers the three questions
 * that decide whether the unit mapping works:
 *
 *   1. Which Brivo site names look like units, and which look like amenities?
 *   2. Do residents map to exactly one unit, or several?
 *   3. Does the roster carry email and phone — assumption #1 in the handoff,
 *      the one that collapses the entry point if it's wrong?
 *
 * ?siteSlug=east-ponds  (required)
 * ?pattern=^[0-9]{1,5}$ (optional — try a pattern without saving it)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!configured.supabase()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const slug = req.nextUrl.searchParams.get('siteSlug')
  if (!slug) {
    return NextResponse.json({ error: 'siteSlug is required' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data: site } = await db.from('sites')
    .select('id, name, slug, brivo_unit_source, brivo_unit_pattern, brivo_unit_exclude, ' +
            'brivo_auth_basic, brivo_api_key, brivo_username, brivo_password')
    .eq('slug', slug).maybeSingle()
    .returns<{
      id: string; name: string; slug: string
      brivo_unit_source: UnitSource | null
      brivo_unit_pattern: string | null
      brivo_unit_exclude: string[] | null
      brivo_auth_basic: string | null; brivo_api_key: string | null
      brivo_username: string | null; brivo_password: string | null
    }>()

  if (!site) return NextResponse.json({ error: 'site_not_found' }, { status: 404 })
  if (!site.brivo_auth_basic || !site.brivo_api_key || !site.brivo_username || !site.brivo_password) {
    return NextResponse.json({ error: 'no_brivo_credentials_on_site' }, { status: 400 })
  }

  const creds = {
    authBasic: site.brivo_auth_basic, apiKey: site.brivo_api_key,
    username: site.brivo_username, password: site.brivo_password,
  }
  const cfg = {
    source: (site.brivo_unit_source ?? 'brivo_site') as UnitSource,
    pattern: req.nextUrl.searchParams.get('pattern') ?? site.brivo_unit_pattern,
    exclude: site.brivo_unit_exclude ?? [],
  }

  // Contact coverage — cheap, and it settles the highest-risk assumption.
  let contact: Record<string, number | string> = {}
  try {
    const token = await getToken(creds)
    const res = await fetch('https://api.brivo.com/v1/api/users?pageSize=100&offset=0', {
      headers: { Authorization: `bearer ${token}`, 'api-key': creds.apiKey.trim() },
      cache: 'no-store',
    })
    const json = (await res.json()) as Record<string, unknown>
    const sample = (json.data ?? json.users ?? []) as {
      email?: string; phoneNumbers?: { number: string }[]
    }[]
    contact = {
      sampled: sample.length,
      withEmail: sample.filter(u => u.email).length,
      withPhone: sample.filter(u => u.phoneNumbers?.[0]?.number).length,
      withNeither: sample.filter(u => !u.email && !u.phoneNumbers?.[0]?.number).length,
    }
  } catch (err) {
    contact = { error: err instanceof Error ? err.message : String(err) }
  }

  const topo = await buildUnitMap(creds, cfg)
  const mapped = Object.keys(topo.map).length
  const ambiguous = Object.keys(topo.ambiguous).length

  return NextResponse.json({
    property: { name: site.name, slug: site.slug },
    config: { source: cfg.source, pattern: cfg.pattern ?? '(default: digits + optional letter)', exclude: cfg.exclude },

    contactCoverage: contact,

    unitMapping: {
      complete: topo.complete,
      error: topo.error ?? null,
      groupsScanned: topo.groupsScanned,
      residentsMappedToAUnit: mapped,
      residentsAmbiguous: ambiguous,
    },

    // The two lists that tell you whether the pattern is right.
    looksLikeUnits: topo.unitNames.slice(0, 60),
    ruledOut: topo.excludedNames.slice(0, 60),
    ambiguousExamples: Object.entries(topo.ambiguous).slice(0, 10)
      .map(([userId, units]) => ({ userId, units })),

    verdict:
      !topo.complete ? 'Lookup failed — see error.'
      : topo.unitNames.length === 0
        ? 'No Brivo site matched the unit pattern. Compare ruledOut against real unit names and set brivo_unit_pattern.'
      : ambiguous > mapped * 0.1
        ? 'More than 10% of residents match multiple units. The pattern is probably too loose, or stale permissions need cleaning up in Brivo.'
      : mapped === 0
        ? 'Units were found but no residents are in them. Check that groups carry membership.'
      : 'Mapping looks usable. Set brivo_sync_mode to baseline and run one sync.',
  })
}
