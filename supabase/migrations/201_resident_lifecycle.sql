-- ═════════════════════════════════════════════════════════════════════════════
-- 201_resident_lifecycle.sql
-- Move-in / move-out detection from the Brivo roster
--
-- WHY A RECONCILIATION LOOP AND NOT A WEBHOOK
-- Brivo's event subscriptions carry ACCESS events — door opens — delivered by
-- webhook. Roster changes are not pushed. Every published Brivo integration
-- polls the user endpoint on a schedule. So a resident appearing or vanishing
-- is something we DETECT by diffing, not something we are TOLD.
--
-- That makes absence the move-out signal, and absence lies: a truncated page, a
-- 500 on page 4, or a PMS blip all look exactly like a resident leaving. Most
-- of this migration exists to make that safe.
--
-- Run on BETA first. Additive only.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Per-site sync policy
-- ─────────────────────────────────────────────────────────────────────────────
alter table sites
  -- off      — never sync
  -- baseline — next run records the whole roster as pre-existing and fires
  --            NOTHING. Onboarding a 832-unit property must not send 832
  --            "welcome to your new home" emails to people who moved in years
  --            ago. Leaving baseline is a deliberate act, never inferred.
  -- live     — diffs emit tenancy events
  add column if not exists brivo_sync_mode text not null default 'off'
    check (brivo_sync_mode in ('off','baseline','live')),

  -- Auto-emailing real residents off a roster you have not yet trusted is a
  -- mistake you make once. Default off; flip per property once its sync has
  -- been watched for a few days.
  add column if not exists auto_invite_residents boolean not null default false,

  -- Move-out is only declared after the resident has been absent from this many
  -- consecutive CLEAN runs and for at least this long.
  add column if not exists move_out_confirm_runs  integer not null default 2,
  add column if not exists move_out_grace_hours   integer not null default 24,

  -- If a run sees the roster shrink by more than this, it is treated as a bad
  -- pull, not 200 move-outs. This one guard is what stops a single malformed
  -- API response from telling a building it has moved out.
  add column if not exists roster_shrink_guard_pct numeric(5,2) not null default 15.00,

  -- Where the staff digest goes, when the site has no PM contact set.
  add column if not exists ops_email text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Resident lifecycle columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table residents
  add column if not exists first_seen_at    timestamptz,
  add column if not exists last_seen_at     timestamptz,
  -- Set the first run a resident goes missing; cleared the moment they return.
  -- A resident removed and re-added inside the grace window produces no event.
  add column if not exists missing_since    timestamptz,
  add column if not exists missing_streak   integer not null default 0,
  add column if not exists lifecycle_status text not null default 'current'
    check (lifecycle_status in ('current','pending_move_out','moved_out'));

create index if not exists residents_lifecycle_idx on residents(site_id, lifecycle_status);
create index if not exists residents_brivo_idx     on residents(site_id, brivo_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Tenancies
--
-- The unit of a move-in is a TENANCY, not a person. Someone can move out and
-- move back into a different unit, and both times should behave like a fresh
-- move-in. Keying notifications on the resident row would silently swallow the
-- second one.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists resident_tenancies (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  resident_id     uuid not null references residents(id) on delete cascade,
  unit_number     text,
  status          text not null default 'active'
                    check (status in ('active','ended')),
  -- Detected, not authoritative: this is when WE first saw them, which is not
  -- necessarily their lease date.
  moved_in_at     timestamptz not null default now(),
  moved_out_at    timestamptz,
  -- Increments per tenancy for the same resident at the same site.
  sequence        integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists tenancies_resident_idx on resident_tenancies(resident_id);
create unique index if not exists tenancies_one_active
  on resident_tenancies(resident_id, site_id) where status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Lifecycle events — the audit trail
--
-- Every decision the reconciler makes is written here, including the ones it
-- declined to act on. When someone asks "why didn't this resident get their
-- parking link", this table is the answer.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists resident_lifecycle_events (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  resident_id   uuid references residents(id) on delete set null,
  tenancy_id    uuid references resident_tenancies(id) on delete set null,
  run_id        uuid,

  kind          text not null check (kind in
                  ('moved_in','moved_out','unit_changed','returned','flagged')),
  detail        text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists lifecycle_events_site_idx on resident_lifecycle_events(site_id, created_at desc);
create index if not exists lifecycle_events_kind_idx on resident_lifecycle_events(kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Sync runs — observability
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists brivo_sync_runs (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id) on delete cascade,
  mode               text not null,
  status             text not null default 'running'
                       check (status in ('running','completed','failed','guarded')),
  -- A run that did not fetch every page cleanly MUST NOT be used to conclude
  -- anyone moved out.
  pages_fetched      integer not null default 0,
  fetch_complete     boolean not null default false,

  roster_count       integer,
  previous_count     integer,
  moved_in_count     integer not null default 0,
  moved_out_count    integer not null default 0,
  unit_changed_count integer not null default 0,
  returned_count     integer not null default 0,

  -- Set when the shrink guard trips. The run records what it WOULD have done
  -- and does none of it.
  guard_reason       text,
  error              text,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz
);
create index if not exists sync_runs_site_idx on brivo_sync_runs(site_id, started_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · Notification log
--
-- Idempotency for anything that leaves the building. The key is derived from
-- the tenancy and the message kind, so a re-run, a retry or a duplicate event
-- cannot email the same resident twice.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists notification_log (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,
  site_id          uuid references sites(id) on delete cascade,
  resident_id      uuid references residents(id) on delete set null,
  kind             text not null,
  channel          text not null default 'email',
  recipient        text not null,
  subject          text,
  provider_id      text,
  status           text not null default 'sent'
                     check (status in ('sent','failed','suppressed')),
  error            text,
  created_at       timestamptz not null default now()
);
create index if not exists notification_log_site_idx on notification_log(site_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · Move-in invite tokens
--
-- The resident's link. Single-purpose, expiring, and revoked when the tenancy
-- ends — a move-in link that still works six months after someone left is a
-- way into the building's portal.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists move_in_invites (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  resident_id   uuid not null references residents(id) on delete cascade,
  tenancy_id    uuid references resident_tenancies(id) on delete cascade,
  token         text not null unique,
  sent_to       text,
  sent_at       timestamptz,
  opened_at     timestamptz,
  completed_at  timestamptz,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists move_in_invites_resident_idx on move_in_invites(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8 · RLS — service role only, as everywhere else
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'resident_tenancies','resident_lifecycle_events','brivo_sync_runs',
    'notification_log','move_in_invites'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "service_role_all_%s" on %I;', t, t);
    execute format(
      'create policy "service_role_all_%s" on %I for all to service_role '
      'using (true) with check (true);', t, t);
  end loop;
end $$;

commit;
