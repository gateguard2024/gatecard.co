-- ═════════════════════════════════════════════════════════════════════════════
-- east_ponds.sql — seed one property so the portal has something real to read
--
-- ⚠️  EVERY PRICE, TIER NAME, COUNT AND DATE HERE IS AN ILLUSTRATIVE
--     PLACEHOLDER, carried over from lib/mock/east-ponds.ts. None of it came
--     from Russel. Replace before this touches a resident.
--
-- Run AFTER 200_move_in_portal.sql, on beta first.
-- Assumes the site already exists in the portal's sites table.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Turn the property on ────────────────────────────────────────────────
-- Set the slug by name so this doesn't hardcode a uuid that differs per env.
update sites set
  slug            = 'east-ponds',
  move_in_enabled = true,
  accent_color    = '#6CABD4',
  leasing_phone   = '+14045550142',
  leasing_hours   = 'Mon–Fri 9–6 · Sat 10–4',
  support_email   = 'leasing@eastponds.example'
where name ilike 'East Ponds%';

-- ── 2 · Credentials (screen 02) ─────────────────────────────────────────────
insert into site_credential_options
  (site_id, kind, label, blurb, price_cents, is_default, is_physical, delivery_note, sort_order)
select s.id, v.kind, v.label, v.blurb, v.price_cents, v.is_default, v.is_physical, v.delivery_note, v.sort_order
from sites s
cross join (values
  ('phone',  'Phone key', 'Open the gate and your building door from your phone. Works the moment you finish here.', 0, true,  false, null, 0),
  ('fob',    'Key fob',   'A physical fob for the gate reader. Handy for guests in your household or a spare in the car.', 1500, false, true,  'Ships in 3–5 days. Tap it at the gate once and it activates itself.', 1),
  ('keytag', 'Key tag',   'Same thing, smaller — rides on your keyring.', 1000, false, true, 'Ships in 3–5 days. Tap it at the gate once and it activates itself.', 2)
) as v(kind, label, blurb, price_cents, is_default, is_physical, delivery_note, sort_order)
where s.slug = 'east-ponds'
on conflict (site_id, kind) do nothing;

-- ── 3 · Parking (screen 03) ─────────────────────────────────────────────────
insert into site_parking_tiers
  (site_id, code, label, blurb, monthly_cents, included, total_spaces, sort_order)
select s.id, v.code, v.label, v.blurb, v.monthly_cents, v.included, v.total_spaces, v.sort_order
from sites s
cross join (values
  ('surface', 'Surface lot',    'Open parking anywhere in the resident lot.',   0,    true,  40, 0),
  ('covered', 'Covered space',  'Assigned space under the north canopy.',       2500, false,  6, 1),
  -- Deliberately zero so the waitlist state gets exercised in real data too.
  ('garage',  'Garage space',   'Assigned space in the gated garage, level 1.', 6000, false,  0, 2)
) as v(code, label, blurb, monthly_cents, included, total_spaces, sort_order)
where s.slug = 'east-ponds'
on conflict (site_id, code) do nothing;

-- ── 4 · Offer engine (screen 04) ────────────────────────────────────────────
-- Internet is 'included' here because East Ponds has a bulk ROE — the card
-- becomes an activation helper, never a purchase. DirecTV is left out entirely
-- rather than inserted as 'unavailable'; both render the same (not at all), and
-- absent is cheaper to reason about.
insert into site_offer_rules
  (site_id, service_id, mode, resident_price_cents, billing_period,
   included_reason, cta_label, lease_required, sort_order)
select s.id, sc.id, v.mode, v.price, v.period, v.reason, v.cta, v.required, v.sort_order
from sites s
cross join (values
  ('Internet',           'included', null::integer, 'monthly', 'Covered by your lease at East Ponds', 'Activate my connection', false, 0),
  ('Renters Insurance',  'sellable', 1400,          'monthly', null,                                  'Add coverage',           true,  1),
  ('In-Unit Security',   'quote',    null,          'monthly', null,                                  'Build my system',        false, 2)
) as v(service_name, mode, price, period, reason, cta, required, sort_order)
join service_catalog sc on sc.name ilike v.service_name
where s.slug = 'east-ponds'
on conflict (site_id, service_id) do nothing;

-- ── 5 · Store (screen 05) ───────────────────────────────────────────────────
-- Credential items and merch in one table because they're in one grid. The
-- resident can't tell them apart; `fulfilment` is how the order handler does.
insert into site_store_products
  (site_id, name, blurb, price_cents, image_emoji, fulfilment, credential_kind, in_stock, sort_order)
select s.id, v.name, v.blurb, v.price_cents, v.emoji, v.fulfilment, v.cred_kind, v.in_stock, v.sort_order
from sites s
cross join (values
  ('Extra key fob',        'A spare for the household.',                            1500, '🔑',  'credential', 'fob',    true,  0),
  ('Extra key tag',        'Rides on a keyring.',                                   1000, '🏷️', 'credential', 'keytag', true,  1),
  ('East Ponds doormat',   'Coir, 18×30. Because unit 214 should look like it.',    3400, '🚪',  'merch',      null,     true,  2),
  ('Insulated tumbler',    '20 oz, keeps coffee hot through a Monday.',             2600, '🥤',  'merch',      null,     true,  3),
  ('Canvas tote',          'For the walk back from the package room.',              1800, '👜',  'merch',      null,     false, 4),
  ('Welcome plant',        'A pothos. Genuinely hard to kill.',                     2200, '🪴',  'merch',      null,     true,  5)
) as v(name, blurb, price_cents, emoji, fulfilment, cred_kind, in_stock, sort_order)
where s.slug = 'east-ponds';

-- ── 6 · Commission schedule ─────────────────────────────────────────────────
-- Platform defaults (site_id null). A property that negotiates its own split
-- gets site-scoped rows, which win without restating everything else.
--
-- ⚠️  These percentages are PLACEHOLDERS. The six-tier split was never
--     specified — see AGENTS.md, open questions.
insert into resident_commission_rates (site_id, tier, rate_pct, item_kind)
values
  (null, 'master_agent',   5.00,  null),
  (null, 'master_dealer', 10.00,  null),
  (null, 'install_dealer', 7.50,  null),
  (null, 'service_dealer', 5.00,  null),
  -- Merch carries a thinner split; the goods cost real money.
  (null, 'master_dealer',  5.00,  'merch'),
  (null, 'install_dealer', 2.50,  'merch')
on conflict do nothing;

commit;
