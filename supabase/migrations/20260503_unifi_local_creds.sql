-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: UniFi Access local controller credentials + contact sync tracking
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sites: local controller config ───────────────────────────────────────────
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS unifi_controller_url     text,        -- e.g. https://192.168.1.1
  ADD COLUMN IF NOT EXISTS unifi_local_username     text,        -- local admin (NOT UI.com SSO)
  ADD COLUMN IF NOT EXISTS unifi_local_password     text,        -- stored in Supabase, accessed only by Pi agent
  ADD COLUMN IF NOT EXISTS unifi_last_contact_sync  timestamptz, -- last successful directory push
  ADD COLUMN IF NOT EXISTS unifi_contact_count      integer;     -- # contacts currently in UniFi

-- Index: Pi agent queries active sites with a controller configured
CREATE INDEX IF NOT EXISTS idx_sites_unifi_controller
  ON sites (id)
  WHERE unifi_controller_url IS NOT NULL AND active = true;

-- ── residents: track which UniFi directory entry maps to this resident ────────
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS unifi_directory_id  text;  -- UniFi Access user/entry ID returned on create

-- Index: fast lookup when deleting stale entries
CREATE INDEX IF NOT EXISTS idx_residents_unifi_directory_id
  ON residents (unifi_directory_id)
  WHERE unifi_directory_id IS NOT NULL;

-- ── sync_log: audit trail for all Pi sync runs ────────────────────────────────
CREATE TABLE IF NOT EXISTS unifi_sync_log (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid          NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  ran_at        timestamptz   NOT NULL DEFAULT now(),
  duration_ms   integer,
  added         integer       NOT NULL DEFAULT 0,
  updated       integer       NOT NULL DEFAULT 0,
  deleted       integer       NOT NULL DEFAULT 0,
  skipped       integer       NOT NULL DEFAULT 0,
  error         text,
  status        text          NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'partial', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_unifi_sync_log_site_ran
  ON unifi_sync_log (site_id, ran_at DESC);

-- Keep only the last 90 days of logs (run periodically or via pg_cron if enabled)
-- DELETE FROM unifi_sync_log WHERE ran_at < now() - interval '90 days';

COMMENT ON TABLE  unifi_sync_log                    IS 'Audit log of Pi agent sync runs — Supabase residents → UniFi Access intercom directory';
COMMENT ON COLUMN sites.unifi_controller_url        IS 'Base URL of local UniFi Access controller, e.g. https://192.168.1.1';
COMMENT ON COLUMN sites.unifi_local_username        IS 'Local admin account (not UI.com SSO — avoids MFA)';
COMMENT ON COLUMN sites.unifi_local_password        IS 'Local admin password — only read by Pi agent via service role key';
COMMENT ON COLUMN sites.unifi_last_contact_sync     IS 'Timestamp of last successful contacts push from Pi agent';
COMMENT ON COLUMN sites.unifi_contact_count         IS 'Number of directory entries currently in UniFi Access';
COMMENT ON COLUMN residents.unifi_directory_id      IS 'UniFi Access internal ID for this resident directory entry';
