-- Migration: 20260506_pinned_residents
-- Adds `pinned` column to residents table.
-- Pinned residents are permanent entries (leasing office, EMS, etc.)
-- that survive Brivo deactivation and Pi sync deletion cycles.

-- 1. Add pinned column (default false — existing rows are all unpinned)
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- 2. Clear unifi_directory_id for East Ponce Village so the next Pi sync
--    deletes stale phoneless entries and recreates them with E.164 phones.
UPDATE residents
SET unifi_directory_id = NULL
WHERE site_id = (SELECT id FROM sites WHERE slug = 'east-ponce-village')
  AND pinned = false;

-- 3. Insert pinned leasing office entry for East Ponce Village.
--    display_name is a generated column (first_name || ' ' || last_name) — don't touch it.
--    The intercom will show "Leasing O." but we want "Leasing Office" so we set
--    first_name = 'Leasing Office' and last_name = '' to get display_name = 'Leasing Office'.
INSERT INTO residents (
  site_id,
  first_name,
  last_name,
  phone,
  active,
  pinned,
  last_synced_at
)
SELECT
  id AS site_id,
  'Leasing Office' AS first_name,
  ''               AS last_name,
  NULL             AS phone,       -- fill in the actual leasing office phone after insert
  true             AS active,
  true             AS pinned,
  now()            AS last_synced_at
FROM sites
WHERE slug = 'east-ponce-village'
ON CONFLICT DO NOTHING;

-- 4. Insert pinned EMS entry for East Ponce Village.
--    PIN 8080 must be set directly in UniFi Access as an access credential
--    (not via the directory sync) — the directory entry just enables calling.
INSERT INTO residents (
  site_id,
  first_name,
  last_name,
  phone,
  active,
  pinned,
  last_synced_at
)
SELECT
  id AS site_id,
  'EMS'  AS first_name,
  ''     AS last_name,
  NULL   AS phone,       -- EMS uses PIN entry not phone call; fill in if they need a callback number
  true   AS active,
  true   AS pinned,
  now()  AS last_synced_at
FROM sites
WHERE slug = 'east-ponce-village'
ON CONFLICT DO NOTHING;
