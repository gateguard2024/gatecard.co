-- ═════════════════════════════════════════════════════════════════════════════
-- 206_store_fulfilment.sql
-- One checkout in the portal, Stripe takes the money, Shopify ships the goods
--
-- THE FLOW
--   resident checks out  →  Stripe PaymentIntent (portal UI, one payment)
--                        →  webhook: order marked paid
--                        →  provisioning job: create the Shopify order
--                        →  supplier ships, tracking flows back
--
-- THE FAILURE THAT MATTERS
-- Stripe succeeds and Shopify fails. The resident is charged and nothing ships,
-- and nobody learns about it until they ask where their doormat is. So order
-- creation is a QUEUED, RETRIED job with an idempotency key — never an inline
-- call in the webhook — and a failed job is visible to staff rather than a log
-- line nobody reads.
--
-- Money is never taken for something that cannot be fulfilled: the reverse
-- order (Shopify first, then charge) would leave unpaid orders in Shopify on
-- every abandoned card, which is worse to reconcile.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

alter table resident_orders
  -- Where the physical goods go. Dropship needs a real address, and the flow
  -- never asked for one — a resident moving in on the 5th may not be able to
  -- receive a parcel at the unit before then.
  add column if not exists ship_to            text
    check (ship_to is null or ship_to in ('unit','leasing_office')),
  add column if not exists shipping_address   jsonb,
  add column if not exists shipping_cents     integer not null default 0,

  -- Stripe Tax computes this; stored so the receipt and Shopify agree.
  add column if not exists tax_cents_computed integer,

  -- The Shopify side, for reconciliation. Null while unfulfilled.
  add column if not exists shopify_order_id   text,
  add column if not exists shopify_order_name text,
  add column if not exists fulfilment_error   text;

create index if not exists resident_orders_shopify_idx
  on resident_orders(shopify_order_id) where shopify_order_id is not null;

-- Per-property shipping and delivery policy.
alter table sites
  add column if not exists merch_shipping_cents integer not null default 0,
  -- Some properties will not accept parcels for a resident who has not moved
  -- in yet; others hold everything at the office regardless.
  add column if not exists merch_ship_to text not null default 'unit'
    check (merch_ship_to in ('unit','leasing_office'));

-- Allow the new job kind.
alter table provisioning_jobs drop constraint if exists provisioning_jobs_kind_check;
alter table provisioning_jobs add constraint provisioning_jobs_kind_check
  check (kind in (
    'brivo_credential','fob_enroll','parking_assign','gatecard_issue',
    'welcome_message','service_order','shopify_order'));

-- Orders that took money but have not been handed to a supplier.
--
-- This is the view someone should be looking at daily. An order sitting here
-- is a resident who has paid for something nobody is shipping.
create or replace view unfulfilled_paid_orders as
  select o.id,
         o.site_id,
         o.resident_id,
         o.total_cents,
         o.paid_at,
         o.fulfilment_error,
         j.status  as job_status,
         j.attempts,
         j.last_error
    from resident_orders o
    left join provisioning_jobs j
      on j.kind = 'shopify_order'
     and j.idempotency_key = 'shopify:' || o.id::text
   where o.status = 'paid'
     and o.shopify_order_id is null
     and exists (
       select 1 from resident_order_items i
        where i.order_id = o.id and i.kind = 'merch'
     );

comment on view unfulfilled_paid_orders is
  'Paid orders containing physical goods with no Shopify order yet. A row here '
  'is a resident who has been charged for something nobody is shipping.';

commit;
