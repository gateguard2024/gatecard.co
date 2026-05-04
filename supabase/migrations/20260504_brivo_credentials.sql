-- ─────────────────────────────────────────────────────────────────────────────
-- GateCard — Add per-site Brivo credentials to sites table
--
-- Each property has its own Brivo account with separate credentials.
-- These are used by /api/sync/brivo to OAuth into Brivo and pull residents.
--
-- How to get these values:
--   brivo_api_key    → Brivo developer portal → API Keys
--   brivo_auth_basic → Base64 of "client_id:client_secret" from Brivo OAuth app
--   brivo_username   → Brivo admin login email for this property account
--   brivo_password   → Brivo admin login password for this property account
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS brivo_api_key      text,
  ADD COLUMN IF NOT EXISTS brivo_auth_basic   text,
  ADD COLUMN IF NOT EXISTS brivo_username     text,
  ADD COLUMN IF NOT EXISTS brivo_password     text;

COMMENT ON COLUMN sites.brivo_api_key    IS 'Brivo API key for this property account';
COMMENT ON COLUMN sites.brivo_auth_basic IS 'Base64-encoded client_id:client_secret for Brivo OAuth';
COMMENT ON COLUMN sites.brivo_username   IS 'Brivo admin username (email) for this property';
COMMENT ON COLUMN sites.brivo_password   IS 'Brivo admin password for this property';
