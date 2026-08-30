-- ═════════════════════════════════════════════════════════════════════════════
-- 205_concessions_and_terms.sql
-- Comped fees, and leases shorter than a year
--
-- A concession is the PROPERTY comping a resident's parking and amenity fee —
-- all of it or part — as a leasing concession. The resident never buys one; it
-- is granted to them, and properties buy them in blocks.
--
-- Money rules this schema enforces:
--
--  * A concession can never exceed the fee. Clamped in lib/fees.ts as well, so
--    a fat-fingered grant shows a zero fee rather than a credit.
--  * A concession that expires before the lease does is stated to the resident
--    up front. A payment going UP partway through a lease, unannounced, is the
--    most complaint-generating thing in this whole flow.
--  * Nothing here touches access. A lapsed concession is a billing matter, not
--    a reason anyone's key stops working.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ── Lease terms ─────────────────────────────────────────────────────────────
-- Short leases are ordinary: 3, 6 and 9-month terms, corporate stays, sublets.
-- Twelve months is an assumption, not a fact, and the fee has to behave when
-- it doesn't hold.
alter table residents
  add column if not exists lease_term_months integer
    check (lease_term_months is null or lease_term_months between 1 and 60),
  add column if not exists lease_end_date date;

-- ── The fee itself, per property ────────────────────────────────────────────
alter table sites
  add column if not exists parking_fee_label  text default 'Parking & amenity fee',
  add column if not exists parking_fee_cents  integer,
  add column if not exists parking_fee_covers text;

-- ── Concession passes a property has bought ─────────────────────────────────
-- Bought in blocks, drawn down as they are granted. `remaining` is generated
-- rather than maintained, so it cannot drift from the two numbers it derives
-- from.
create table if not exists site_concession_passes (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  org_id         uuid references organizations(id),

  label          text not null default 'Parking & amenity concession',
  -- What one pass covers per month, and for how long.
  covers_cents   integer not null,
  months         integer,                       -- null = for the whole lease

  quantity       integer not null default 0,
  allocated      integer not null default 0,
  remaining      integer generated always as (quantity - allocated) stored,

  -- What the property paid for the block, for reconciliation. Null when the
  -- passes were bundled into a contract rather than bought outright.
  purchase_cents integer,
  purchased_at   timestamptz,
  expires_on     date,
  notes          text,
  created_at     timestamptz not null default now(),

  constraint passes_not_over_allocated check (allocated <= quantity)
);
create index if not exists concession_passes_site_idx on site_concession_passes(site_id);

-- ── Concessions granted to a resident ───────────────────────────────────────
create table if not exists resident_concessions (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  resident_id   uuid not null references residents(id) on delete cascade,
  tenancy_id    uuid references resident_tenancies(id) on delete set null,
  pass_id       uuid references site_concession_passes(id) on delete set null,

  -- Cents per month covered. Partial is simply a smaller number than the fee;
  -- there is no separate "percent" mode, because a percentage of a fee that
  -- later changes silently changes the concession too.
  covers_cents  integer not null check (covers_cents > 0),
  label         text,
  months        integer,          -- null = for the whole lease term
  starts_on     date not null default current_date,
  ends_on       date,

  status        text not null default 'active'
                  check (status in ('active','expired','revoked')),
  granted_by    text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists resident_concessions_resident_idx
  on resident_concessions(resident_id);
-- One live concession per resident. Stacking them is a business decision
-- nobody has made, and silently summing two grants is not the way to make it.
create unique index if not exists resident_concessions_one_active
  on resident_concessions(resident_id) where status = 'active';

-- Keep the pass block's allocated count honest.
create or replace function bump_concession_allocation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.pass_id is not null then
    update site_concession_passes set allocated = allocated + 1 where id = new.pass_id;
  elsif tg_op = 'DELETE' and old.pass_id is not null then
    update site_concession_passes set allocated = greatest(allocated - 1, 0) where id = old.pass_id;
  end if;
  return null;
end;
$$;

drop trigger if exists resident_concessions_allocation on resident_concessions;
create trigger resident_concessions_allocation
  after insert or delete on resident_concessions
  for each row execute function bump_concession_allocation();

drop trigger if exists resident_concessions_updated_at on resident_concessions;
create trigger resident_concessions_updated_at
  before update on resident_concessions
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['site_concession_passes','resident_concessions'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "service_role_all_%s" on %I;', t, t);
    execute format('create policy "service_role_all_%s" on %I for all to service_role '
                   'using (true) with check (true);', t, t);
  end loop;
end $$;

commit;
