-- Add feature flags to sites
-- Each key maps to a module the property has licensed.
-- Resident sees: gates, doors, packages, community_channel, cameras, energy, smart_locks, climate, service_request, music
-- Admin sees above + visitors, network

alter table sites
  add column if not exists features jsonb not null default '{}'::jsonb;

-- Seed Parkview with all features enabled for demo
update sites
set features = '{
  "gates":             true,
  "doors":             true,
  "visitors":          true,
  "packages":          true,
  "community_channel": true,
  "cameras":           true,
  "energy":            true,
  "network":           true,
  "smart_locks":       true,
  "climate":           true,
  "service_request":   true,
  "music":             true
}'::jsonb
where slug = 'parkview-apts';
