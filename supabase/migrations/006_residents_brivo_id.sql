-- ── Add Brivo user ID to residents for sync upsert matching ──────────────────
alter table residents
  add column if not exists brivo_user_id text;

-- Unique per site — same Brivo user can't be in the same property twice
create unique index if not exists residents_brivo_user_site_idx
  on residents(site_id, brivo_user_id)
  where brivo_user_id is not null;

-- Track when the row was last synced from Brivo
alter table residents
  add column if not exists last_synced_at timestamptz;

comment on column residents.brivo_user_id   is 'Brivo user ID — used as stable key during hourly sync';
comment on column residents.last_synced_at  is 'Timestamp of last successful Brivo sync for this resident';
