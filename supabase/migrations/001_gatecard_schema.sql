-- ─────────────────────────────────────────────────────────────────────────────
-- GateCard Sprint 1 Schema
-- Run against your Supabase project (SQL editor or supabase db push)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sites ────────────────────────────────────────────────────────────────────
create table if not exists sites (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,           -- URL slug, e.g. "parkview-apts"
  name          text not null,                  -- "Parkview Apartments"
  address       text not null,
  city          text not null,
  state         char(2) not null,
  leasing_phone text,                           -- E.164, e.g. "+14045550100"
  soc_phone     text,                           -- Security Ops Center phone
  brivo_site_id text,                           -- Brivo door/site ID for gate
  een_camera_id text,                           -- Eagle Eye camera ID at entry
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── residents ────────────────────────────────────────────────────────────────
create table if not exists residents (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  unit_number   text not null,                  -- "101", "2B", etc.
  first_name    text not null,
  last_name     text not null,
  display_name  text generated always as (first_name || ' ' || last_name) stored,
  phone         text,                           -- E.164 for Twilio dial-out
  email         text,                           -- for magic-link resident portal (Sprint 2)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists residents_site_id_idx on residents(site_id);
create index if not exists residents_search_idx  on residents
  using gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || unit_number));

-- ── access_events ─────────────────────────────────────────────────────────────
create table if not exists access_events (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  resident_id   uuid references residents(id) on delete set null,

  entry_type    text not null check (entry_type in (
                  'directory', 'packages', 'leasing', 'emergency'
                )),

  -- Twilio
  call_sid      text,                           -- TW call SID, set after dial

  -- Outcome state machine
  -- initiated → ringing → answered → gate_opened | denied | no_answer | failed | cancelled
  outcome       text not null default 'initiated' check (outcome in (
                  'initiated', 'ringing', 'answered',
                  'gate_opened', 'denied', 'no_answer', 'failed', 'cancelled'
                )),

  -- Cached at event creation (resident may later be deactivated)
  resident_unit text,                           -- snapshot of unit number at time of event

  -- Eagle Eye snapshot
  photo_url     text,                           -- Supabase Storage public URL

  -- Gate open
  gate_opened   boolean not null default false,
  gate_opened_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists access_events_site_id_idx     on access_events(site_id);
create index if not exists access_events_resident_id_idx on access_events(resident_id);
create index if not exists access_events_created_at_idx  on access_events(created_at desc);

-- auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists access_events_updated_at on access_events;
create trigger access_events_updated_at
  before update on access_events
  for each row execute function set_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────
-- Public (anon key): read-only on sites and residents for the visitor kiosk
alter table sites     enable row level security;
alter table residents enable row level security;
alter table access_events enable row level security;

-- Visitors can read active sites (needed for site lookup by slug)
drop policy if exists "public_read_active_sites" on sites;
create policy "public_read_active_sites" on sites
  for select using (active = true);

-- Visitors can read active residents for directory search
drop policy if exists "public_read_active_residents" on residents;
create policy "public_read_active_residents" on residents
  for select using (active = true);

-- access_events: only service role can read/write (no anon access)
-- (The API routes use supabaseAdmin() which bypasses RLS)

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Run this in the Supabase dashboard → Storage → New bucket, or:
-- insert into storage.buckets (id, name, public) values ('visitor-photos', 'visitor-photos', false);
-- Bucket is private; photo_url will be a signed URL generated by the API.

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed  (run separately or toggle the block below)
-- ─────────────────────────────────────────────────────────────────────────────
-- See: supabase/seeds/demo_property.sql
