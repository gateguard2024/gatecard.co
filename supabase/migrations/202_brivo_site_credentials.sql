-- ═════════════════════════════════════════════════════════════════════════════
-- 202_brivo_site_credentials.sql
--
-- Each property is its own Brivo account with its own credentials, so they live
-- on the site row rather than in env. Carried over from the shape the previous
-- gatecard.co sync already used and proved at East Ponce.
--
-- ⚠️  These are secrets sitting in a database column. They are reachable only
--     through the service role (RLS denies anon), but at scale they belong in a
--     KMS or Supabase Vault. Recorded here as a known debt, not a design.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

alter table sites
  add column if not exists brivo_auth_basic text,
  add column if not exists brivo_api_key    text,
  add column if not exists brivo_username   text,
  add column if not exists brivo_password   text,

  -- Brivo does not carry a unit number natively. The previous sync never
  -- populated one — every resident row it wrote had a null unit, which a
  -- unit-scoped move-in portal cannot work with.
  --
  -- Where the unit actually lives varies per account: usually a custom field,
  -- sometimes encoded in a group name. Name the source per site rather than
  -- guessing, and leave it null if the property hasn't been mapped yet — a
  -- resident with no unit is flagged for staff, never silently onboarded.
  add column if not exists brivo_unit_field text default 'Unit';

commit;
