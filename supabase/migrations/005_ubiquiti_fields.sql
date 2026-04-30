-- ── Ubiquiti callbox integration fields on sites ──────────────────────────────
-- ubiquiti_host_id       : Site Manager host ID (for read-only cloud monitoring)
-- ubiquiti_controller_url: Local UniFi OS URL, e.g. "https://192.168.1.1"
-- ubiquiti_controller_token: Local controller API token (UniFi Access)
-- ubiquiti_door_id       : UniFi Access device ID for the entry door/gate
-- ubiquiti_webhook_secret: Shared secret appended to webhook URL for verification

alter table sites
  add column if not exists ubiquiti_host_id          text,
  add column if not exists ubiquiti_controller_url   text,
  add column if not exists ubiquiti_controller_token text,
  add column if not exists ubiquiti_door_id          text,
  add column if not exists ubiquiti_webhook_secret   text;

comment on column sites.ubiquiti_host_id          is 'UniFi Site Manager host ID (cloud read-only)';
comment on column sites.ubiquiti_controller_url   is 'Local UniFi OS base URL, e.g. https://192.168.1.1';
comment on column sites.ubiquiti_controller_token is 'UniFi Access local API bearer token';
comment on column sites.ubiquiti_door_id          is 'UniFi Access device ID for the entry gate/door';
comment on column sites.ubiquiti_webhook_secret   is 'Secret token in webhook URL path for request verification';
