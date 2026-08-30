-- ═════════════════════════════════════════════════════════════════════════════
-- 207_store_codes.sql
-- The community store moves to a per-resident discount code
--
-- SUPERSEDES the in-portal merch checkout added in 206. That path charged on
-- Stripe and then created a Shopify order, which meant we inherited tax,
-- shipping rates, the shipping address, and the failure mode where Stripe
-- succeeds and Shopify doesn't.
--
-- Issuing a code instead collapses all of it. The money and the order become
-- one transaction inside Shopify, so:
--   * tax and shipping go back to Shopify, where they were already solved
--   * charged-but-not-shipped becomes impossible
--   * the resident picks their own delivery address, which also solves
--     "moving in on the 5th, can't receive a parcel at the unit yet"
--   * refunds happen in one system
--
-- WHAT WE GIVE UP, and how it is recovered: merch revenue no longer passes
-- through Stripe, so it does not reach the Connect commission ledger on its
-- own. The code is the attribution key — a Shopify orders/create webhook names
-- the code, the code names the resident, and the commission entry is written
-- from that.
--
-- Credentials (fob, key tag) do NOT move to Shopify. They are Brivo
-- enrollments shipped from Gate Guard stock, and they stay in our checkout.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

alter table sites
  add column if not exists store_discount_percent numeric(5,2) not null default 15.00,
  add column if not exists store_code_days integer not null default 30,
  -- Where the resident is sent to shop. Null disables the store for a property.
  add column if not exists store_url text;

create table if not exists resident_store_codes (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  resident_id     uuid not null references residents(id) on delete cascade,
  tenancy_id      uuid references resident_tenancies(id) on delete set null,

  code            text not null unique,
  percent_off     numeric(5,2) not null,

  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  -- Single use. Set when Shopify tells us it was redeemed.
  redeemed_at     timestamptz,
  redeemed_order  text,
  redeemed_cents  integer,

  -- Shopify's own handle for the discount, so it can be revoked or expired.
  shopify_discount_id text,

  status          text not null default 'active'
                    check (status in ('active','redeemed','expired','revoked')),
  created_at      timestamptz not null default now()
);

create index if not exists store_codes_resident_idx on resident_store_codes(resident_id);
create index if not exists store_codes_site_idx     on resident_store_codes(site_id);
create index if not exists store_codes_status_idx   on resident_store_codes(status);

-- One live code per resident. Two live codes is either a double-issue bug or a
-- resident with two bites at a single-use welcome offer.
create unique index if not exists store_codes_one_active
  on resident_store_codes(resident_id) where status = 'active';

-- A code outlives nothing: it dies with the tenancy. A welcome discount still
-- working for someone who moved out in March is a small leak that never stops.
create or replace function expire_store_codes_on_move_out()
returns trigger language plpgsql as $$
begin
  if new.status = 'ended' and old.status <> 'ended' then
    update resident_store_codes
       set status = 'revoked'
     where resident_id = new.resident_id
       and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists tenancy_revokes_store_code on resident_tenancies;
create trigger tenancy_revokes_store_code
  after update on resident_tenancies
  for each row execute function expire_store_codes_on_move_out();

alter table provisioning_jobs drop constraint if exists provisioning_jobs_kind_check;
alter table provisioning_jobs add constraint provisioning_jobs_kind_check
  check (kind in (
    'brivo_credential','fob_enroll','parking_assign','gatecard_issue',
    'welcome_message','service_order','shopify_order','store_code'));

alter table resident_store_codes enable row level security;
drop policy if exists "service_role_all_resident_store_codes" on resident_store_codes;
create policy "service_role_all_resident_store_codes" on resident_store_codes
  for all to service_role using (true) with check (true);

commit;
