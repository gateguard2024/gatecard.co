-- ═════════════════════════════════════════════════════════════════════════════
-- 203_brivo_unit_topology.sql
--
-- ⚠️  NAMING COLLISION — READ THIS BEFORE TOUCHING ANY OF IT
--
--     our `sites` table  = a PROPERTY   (East Ponds)
--     a Brivo "site"     = a UNIT       (214)
--
--     They are not the same thing and never will be. Anything in the codebase
--     referring to Brivo's concept is named `brivoUnitSite` / `brivo_unit_site`,
--     never plain "site". Getting this wrong silently maps 832 residents to the
--     wrong property.
--
-- Units are modelled as Brivo sites at these properties, so a resident's unit
-- comes from the access topology, not from a field on the user. Brivo exposes
-- no direct user→site edge; it runs through groups:
--
--     user ──< group membership >── group ──< access permission >── site (unit)
--
-- So the unit map is built group-first: list groups, resolve each group's unit,
-- then list that group's members. That is O(groups) requests rather than
-- O(users) — ~300 calls for an 832-resident property instead of 832.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

alter table sites
  -- Where a unit number actually comes from at THIS property. Varies per
  -- account; do not guess it — /api/brivo/probe reports what the account
  -- really looks like.
  add column if not exists brivo_unit_source text not null default 'brivo_site'
    check (brivo_unit_source in ('brivo_site','group','custom_field')),

  -- Residents have access to more than their unit: the vehicle gate, the
  -- clubhouse, the pool, the package room are all Brivo sites too. Without a
  -- way to tell a unit from an amenity, every resident "lives in" the Main Gate.
  --
  -- A regex that a unit name matches, e.g. '^[0-9]{1,5}[A-Za-z]?$' for 214/214B.
  add column if not exists brivo_unit_pattern text,
  -- Belt and braces: names that are never units, whatever the pattern says.
  add column if not exists brivo_unit_exclude text[] not null default '{}',

  -- Topology changes rarely; the roster changes constantly. Cache it.
  add column if not exists brivo_topology_ttl_minutes integer not null default 360;

-- ─────────────────────────────────────────────────────────────────────────────
-- The cached user → unit map
--
-- Rebuilt on TTL expiry, or immediately when a roster user has no entry — a new
-- resident always arrives unmapped, and waiting six hours to learn their unit
-- would delay every move-in.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists brivo_unit_map_cache (
  site_id        uuid primary key references sites(id) on delete cascade,
  -- { "<brivoUserId>": "214", ... }
  unit_map       jsonb not null default '{}'::jsonb,
  -- Names that looked like units, and names that were ruled out. Kept so the
  -- pattern can be tuned from real data rather than from guesses.
  unit_names     text[] not null default '{}',
  excluded_names text[] not null default '{}',
  -- Users matching more than one unit-like site. Never guessed at — flagged.
  ambiguous      jsonb not null default '{}'::jsonb,
  groups_scanned integer not null default 0,
  built_at       timestamptz not null default now(),
  error          text
);

alter table brivo_unit_map_cache enable row level security;
drop policy if exists "service_role_all_brivo_unit_map_cache" on brivo_unit_map_cache;
create policy "service_role_all_brivo_unit_map_cache" on brivo_unit_map_cache
  for all to service_role using (true) with check (true);

commit;
