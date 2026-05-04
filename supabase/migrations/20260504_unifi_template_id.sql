-- ─────────────────────────────────────────────────────────────────────────────
-- GateCard — Add unifi_template_id to sites
--
-- The UniFi Access intercom directory is organized under "templates".
-- Each site's template ID must be stored here so the Pi agent knows
-- which template to read/write when syncing the resident directory.
--
-- How to find the template ID for a site:
--   Run in the browser console on the controller:
--   fetch('/proxy/access/api/v2/templates').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))
--   Copy the "id" field from the matching template object.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS unifi_template_id text;

COMMENT ON COLUMN sites.unifi_template_id IS
  'UniFi Access intercom template UUID. Found via GET /proxy/access/api/v2/templates on the local controller.';
