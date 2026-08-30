-- ═════════════════════════════════════════════════════════════════════════════
-- 204_directory_listing.sql
-- Callbox directory opt-in / opt-out
--
-- The digital callbox directory is what a guest or courier searches to call a
-- resident. Being in it is a privacy decision, and privacy decisions are far
-- harder to retrofit than to build in — so it lands before the first resident.
--
-- TWO RULES THIS SCHEMA EXISTS TO ENFORCE
--
--  1. Listing NEVER affects access. There is no path from directory_listed to
--     a credential. An unlisted resident opens the gate exactly like a listed
--     one. (A vendor removing someone's access over a directory preference
--     would be a lockout — see AGENTS.md D3.)
--
--  2. Unlisted must not silently break deliveries. The portal says plainly what
--     stops working; this schema keeps the resident reachable by unit number so
--     the leasing office still has an answer for a courier at the gate.
--
-- DOWNSTREAM: the Pi agent writes residents into the UniFi Access intercom
-- directory. It MUST filter on directory_listed, or an opt-out is meaningless —
-- the resident's name would still be on the callbox screen at the gate.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

alter table sites
  -- required — the property mandates listing (unstaffed gate, deliveries fail
  --            without it). Shown and explained, but not editable.
  -- optional — the resident chooses.
  -- hidden   — no directory at this property; the section never renders.
  add column if not exists directory_mode text not null default 'optional'
    check (directory_mode in ('required','optional','hidden')),

  -- Where the toggle starts when optional. A staffed lobby can reasonably
  -- default to unlisted; an unstaffed gate cannot.
  add column if not exists directory_default_listed boolean not null default true,

  -- Which name formats this property permits, in display order.
  add column if not exists directory_formats text[] not null
    default array['last_initial','full','unit_only'],

  -- Why it matters here, in the property's own words.
  add column if not exists directory_note text;

alter table residents
  add column if not exists directory_listed boolean not null default true,
  add column if not exists directory_name_format text not null default 'last_initial'
    check (directory_name_format in ('full','last_initial','unit_only')),
  add column if not exists directory_updated_at timestamptz;

-- Only listed residents, with the name each of them chose.
--
-- The Pi sync agent should read THIS rather than the residents table, so an
-- opt-out cannot be lost by a later change to the sync query. Pinned entries
-- (leasing office, EMS) are excluded here and pushed separately — they are not
-- residents and must never be opted out by accident.
create or replace view callbox_directory as
  select r.id            as resident_id,
         r.site_id,
         r.unit_number,
         r.phone,
         case r.directory_name_format
           when 'full'         then trim(r.first_name || ' ' || r.last_name)
           when 'unit_only'    then 'Unit ' || coalesce(r.unit_number, '—')
           else trim(r.first_name || ' ' ||
                     upper(left(coalesce(nullif(r.last_name, ''), ' '), 1)) || '.')
         end             as display_name,
         r.directory_name_format
    from residents r
   where r.active
     and r.directory_listed
     and r.lifecycle_status = 'current'
     and r.phone is not null;   -- a directory entry nobody can ring is furniture

comment on view callbox_directory is
  'Source of truth for the UniFi/callbox intercom directory. Honours each '
  'resident''s opt-out and chosen name format. Never join credentials to this.';

commit;
