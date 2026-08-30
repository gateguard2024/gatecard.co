-- ═════════════════════════════════════════════════════════════════════════════
-- 200_move_in_portal.sql
-- GateCard Resident Move-In Portal — schema
--
-- TARGET: the PORTAL Supabase project (jtvxfmhlmokyuzdxxqpp), which already
-- owns organizations, sites, residents, service_catalog, commission_payouts.
-- Run on BETA first, verify, then prod — the portal's standing rule.
--
-- ADDITIVE ONLY. This migration creates new tables and adds nullable columns.
-- It does not alter or drop anything the portal already relies on.
--
-- Naming: everything resident-facing is prefixed so it never collides with the
-- portal's B2B objects. `invoices` bills a property; `resident_orders` bills a
-- person. They are deliberately different tables — see AGENTS.md, two rails.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Extend sites with what a resident-facing portal needs
-- ─────────────────────────────────────────────────────────────────────────────
alter table sites
  add column if not exists slug              text,
  add column if not exists move_in_enabled   boolean not null default false,
  add column if not exists accent_color      text,          -- per-property accent
  add column if not exists logo_url          text,
  add column if not exists leasing_phone     text,          -- E.164
  add column if not exists leasing_hours     text,
  add column if not exists support_email     text;

-- Slug is the URL segment: gatecard.co/<slug>/move-in
create unique index if not exists sites_slug_key on sites(slug) where slug is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Extend residents
--
-- The portal's residents table is org-scoped. A resident belongs to a PROPERTY,
-- and one org runs many properties, so site_id is required for the portal to
-- scope anything correctly. Nullable here so the migration is safe on existing
-- rows; backfill before enabling move_in on any site.
-- ─────────────────────────────────────────────────────────────────────────────
alter table residents
  add column if not exists site_id        uuid references sites(id) on delete cascade,
  add column if not exists move_in_date   date,
  add column if not exists move_out_date  date,
  -- People on one lease. Each still gets their own link and their own
  -- credential — a household never shares a session.
  add column if not exists household_id   uuid;

create index if not exists residents_site_id_idx   on residents(site_id);
create index if not exists residents_household_idx on residents(household_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Offer engine (D7)
--
-- The per-property rules table that decides what a resident may see. This is
-- the product. Nothing about a property belongs in application code.
--
--   sellable    orderable here; commission tracked
--   included    already covered (e.g. a bulk-internet ROE). The card becomes an
--               activation helper, never a purchase, never a price
--   quote       configurator → deposit + monitoring (reuses FORGE)
--   unavailable not offered here; never rendered
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists site_offer_rules (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references sites(id) on delete cascade,
  service_id          uuid references service_catalog(id) on delete cascade,

  mode                text not null default 'unavailable'
                        check (mode in ('sellable','included','quote','unavailable')),

  -- What the RESIDENT pays. Distinct from service_catalog.base_price, which is
  -- the site-level B2B price. Null for included and quote modes.
  resident_price_cents integer,
  billing_period      text not null default 'monthly'
                        check (billing_period in ('once','monthly','annual')),

  -- Shown when mode = 'included' — why it is already covered.
  included_reason     text,
  cta_label           text,
  -- True where the lease mandates it. Drives the day-10 follow-up nudge.
  lease_required      boolean not null default false,
  sort_order          integer not null default 0,

  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (site_id, service_id)
);
create index if not exists site_offer_rules_site_idx on site_offer_rules(site_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Credential options per property (screen 02)
--
-- Exactly one option per site must be the default, and the default must be
-- free — activation can never depend on a card clearing.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists site_credential_options (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  kind           text not null check (kind in ('phone','fob','keytag','card')),
  label          text not null,
  blurb          text,
  price_cents    integer not null default 0,
  is_default     boolean not null default false,
  -- Physical items ship blank and inert and enroll on first tap at the gate.
  is_physical    boolean not null default false,
  delivery_note  text,
  sort_order     integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (site_id, kind)
);

-- One default per site, and it has to be free.
create unique index if not exists site_credential_one_default
  on site_credential_options(site_id) where is_default;

alter table site_credential_options
  drop constraint if exists site_credential_default_is_free;
alter table site_credential_options
  add constraint site_credential_default_is_free
  check (not is_default or price_cents = 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Parking (screen 03)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists site_parking_tiers (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  code           text not null,
  label          text not null,
  blurb          text,
  monthly_cents  integer not null default 0,
  included       boolean not null default false,
  total_spaces   integer not null default 0,
  sort_order     integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (site_id, code)
);

create table if not exists parking_assignments (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  resident_id    uuid not null references residents(id) on delete cascade,
  tier_id        uuid not null references site_parking_tiers(id),
  space_label    text,
  plate          text,
  plate_state    text,
  vehicle_make   text,
  vehicle_model  text,
  vehicle_color  text,
  status         text not null default 'active'
                   check (status in ('active','waitlisted','released')),
  assigned_at    timestamptz not null default now(),
  released_at    timestamptz
);
create index if not exists parking_assign_site_idx  on parking_assignments(site_id);
create index if not exists parking_assign_tier_idx  on parking_assignments(tier_id) where status = 'active';

-- Live availability. A tier at zero still renders — disabled, with a waitlist.
-- Hiding it just makes the resident phone the leasing office.
create or replace view site_parking_availability as
  select t.id            as tier_id,
         t.site_id,
         t.total_spaces,
         count(a.id) filter (where a.status = 'active') as taken,
         greatest(t.total_spaces - count(a.id) filter (where a.status = 'active'), 0)
           as spaces_available
    from site_parking_tiers t
    left join parking_assignments a on a.tier_id = t.id
   group by t.id, t.site_id, t.total_spaces;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · Store (screen 05)
--
-- Credential items and dropship merch live in one table because they live in
-- one grid. `fulfilment` is what tells the order handler them apart: 'merch'
-- routes to the supplier, 'credential' routes to Brivo enrollment.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists site_store_products (
  id                  uuid primary key default gen_random_uuid(),
  -- Null site_id = offered at every property.
  site_id             uuid references sites(id) on delete cascade,
  name                text not null,
  blurb               text,
  price_cents         integer not null,
  image_url           text,
  image_emoji         text,
  fulfilment          text not null check (fulfilment in ('merch','credential')),
  -- Required when fulfilment = 'credential'.
  credential_kind     text check (credential_kind in ('fob','keytag','card')),
  shopify_variant_id  text,
  in_stock            boolean not null default true,
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table site_store_products
  drop constraint if exists store_credential_needs_kind;
alter table site_store_products
  add constraint store_credential_needs_kind
  check (fulfilment <> 'credential' or credential_kind is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7 · Move-in sessions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists move_in_sessions (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  resident_id     uuid not null references residents(id) on delete cascade,
  status          text not null default 'started'
                    check (status in ('started','activated','completed','abandoned')),
  -- Set the moment screens 01-03 are done. Everything after is optional and
  -- must never gate this.
  activated_at    timestamptz,
  completed_at    timestamptz,
  mobile_e164     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists move_in_sessions_resident_idx on move_in_sessions(resident_id);
create index if not exists move_in_sessions_site_idx     on move_in_sessions(site_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8 · Resident orders — the CARD rail only
--
-- Nothing on the mandatory rail is ever written here. See AGENTS.md D3: how the
-- parking + access fee is collected is unresolved, and no code path may connect
-- a payment failure to a credential.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists resident_orders (
  id                       uuid primary key default gen_random_uuid(),
  site_id                  uuid not null references sites(id),
  resident_id              uuid not null references residents(id),
  session_id               uuid references move_in_sessions(id),

  status                   text not null default 'pending'
                             check (status in ('pending','paid','failed','refunded','cancelled')),
  subtotal_cents           integer not null default 0,
  tax_cents                integer not null default 0,
  total_cents              integer not null default 0,
  currency                 text not null default 'usd',

  stripe_payment_intent_id text unique,
  stripe_charge_id         text,
  failure_reason           text,

  paid_at                  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists resident_orders_site_idx     on resident_orders(site_id);
create index if not exists resident_orders_resident_idx on resident_orders(resident_id);
create index if not exists resident_orders_status_idx   on resident_orders(status);

create table if not exists resident_order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references resident_orders(id) on delete cascade,
  kind               text not null check (kind in ('credential','merch','service')),
  -- Points at site_credential_options / site_store_products / site_offer_rules
  -- depending on kind. Deliberately untyped: three parents, one grid.
  ref_id             uuid,
  name               text not null,
  qty                integer not null default 1,
  unit_price_cents   integer not null,
  amount_cents       integer generated always as (qty * unit_price_cents) stored,
  fulfilment_status  text not null default 'pending'
                       check (fulfilment_status in
                         ('pending','enrolling','shipped','delivered','activated','failed','cancelled')),
  tracking_number    text,
  created_at         timestamptz not null default now()
);
create index if not exists resident_order_items_order_idx on resident_order_items(order_id);

create table if not exists resident_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  site_id                uuid not null references sites(id),
  resident_id            uuid not null references residents(id),
  offer_rule_id          uuid references site_offer_rules(id),
  monthly_cents          integer not null,
  status                 text not null default 'active'
                           check (status in ('active','past_due','cancelled','ended')),
  stripe_subscription_id text unique,
  started_at             timestamptz not null default now(),
  cancelled_at           timestamptz,
  ended_at               timestamptz
);
create index if not exists resident_subs_resident_idx on resident_subscriptions(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9 · Commission ledger (D4)
--
-- Supabase owns this. Stripe is the movement layer, not the source of truth —
-- Connect cannot answer "what does this master agent earn this month", and
-- making it model a six-tier hierarchy is how you end up unable to ask.
--
-- Six tiers: corporate → master agent → master dealer →
--            (sales partner / install dealer / service dealer) → client
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists resident_commission_rates (
  id            uuid primary key default gen_random_uuid(),
  -- Null site_id = the default schedule, used when a site has no override.
  site_id       uuid references sites(id) on delete cascade,
  tier          text not null check (tier in
                  ('corporate','master_agent','master_dealer',
                   'sales_partner','install_dealer','service_dealer')),
  rate_pct      numeric(5,2) not null,
  item_kind     text check (item_kind in ('credential','merch','service')),
  effective_from date not null default current_date,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists resident_comm_rates_site_idx on resident_commission_rates(site_id);

create table if not exists dealer_connect_accounts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  stripe_account_id   text not null unique,
  account_type        text not null default 'express',
  charges_enabled     boolean not null default false,
  payouts_enabled     boolean not null default false,
  requirements_due    jsonb,
  onboarded_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id)
);

create table if not exists resident_commission_entries (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id),
  order_id           uuid references resident_orders(id) on delete cascade,
  subscription_id    uuid references resident_subscriptions(id) on delete cascade,
  order_item_id      uuid references resident_order_items(id) on delete cascade,

  party_org_id       uuid references organizations(id),
  tier               text not null check (tier in
                       ('corporate','master_agent','master_dealer',
                        'sales_partner','install_dealer','service_dealer')),

  basis_cents        integer not null,        -- what the rate was applied to
  rate_pct           numeric(5,2) not null,
  amount_cents       integer not null,

  -- Held ~30 days before release so a refund or chargeback doesn't require
  -- clawing money back out of a dealer's bank account.
  status             text not null default 'accrued'
                       check (status in ('accrued','held','released','paid','reversed')),
  hold_until         date,
  pay_period         text,                    -- YYYY-MM
  stripe_transfer_id text,

  -- Separate charges and transfers: one charge on the platform account, then
  -- N transfers. Application fees cannot express four parties on one payment.
  transferred_at     timestamptz,
  reversed_at        timestamptz,
  created_at         timestamptz not null default now(),

  constraint commission_has_a_parent
    check (order_id is not null or subscription_id is not null)
);
create index if not exists resident_comm_site_idx   on resident_commission_entries(site_id);
create index if not exists resident_comm_org_idx    on resident_commission_entries(party_org_id);
create index if not exists resident_comm_status_idx on resident_commission_entries(status);
create index if not exists resident_comm_period_idx on resident_commission_entries(pay_period);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10 · Provisioning queue (D8)
--
-- Idempotent, retriable, and readable by the leasing office. idempotency_key is
-- unique, so a replayed webhook or a retried job cannot issue two credentials.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists provisioning_jobs (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,
  site_id          uuid not null references sites(id) on delete cascade,
  resident_id      uuid references residents(id) on delete cascade,
  order_item_id    uuid references resident_order_items(id) on delete set null,

  kind             text not null check (kind in
                     ('brivo_credential','fob_enroll','parking_assign',
                      'gatecard_issue','welcome_message','service_order')),
  payload          jsonb not null default '{}'::jsonb,

  status           text not null default 'queued'
                     check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts         integer not null default 0,
  last_error       text,
  run_after        timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists provisioning_status_idx   on provisioning_jobs(status, run_after);
create index if not exists provisioning_site_idx     on provisioning_jobs(site_id);
create index if not exists provisioning_resident_idx on provisioning_jobs(resident_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11 · updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'site_offer_rules','move_in_sessions','resident_orders',
    'dealer_connect_accounts'
  ] loop
    execute format(
      'drop trigger if exists %I_updated_at on %I; '
      'create trigger %I_updated_at before update on %I '
      'for each row execute function public.set_updated_at();', t, t, t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12 · Row-level security
--
-- Service role only, matching the portal's existing pattern. The portal app
-- reaches these through API routes with the service key; the anon key gets
-- nothing. Resident-scoped read policies come with the Clerk JWT mapping and
-- are deliberately NOT guessed at here.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'site_offer_rules','site_credential_options','site_parking_tiers',
    'parking_assignments','site_store_products','move_in_sessions',
    'resident_orders','resident_order_items','resident_subscriptions',
    'resident_commission_rates','dealer_connect_accounts',
    'resident_commission_entries','provisioning_jobs'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "service_role_all_%s" on %I;', t, t);
    execute format(
      'create policy "service_role_all_%s" on %I for all to service_role '
      'using (true) with check (true);', t, t);
  end loop;
end $$;

commit;
