# GateCard — Session Handoff Notes
_Last updated: May 6, 2026_

---

## What We Built

A fully automated multi-tenant resident sync system:

```
Brivo (per-property account)
  ↓  hourly via Vercel cron (/api/sync/brivo)
Supabase residents table  (scoped by site_id — sites never share contacts)
  ↓  nightly at 00:30 via Pi systemd timer
UniFi Access intercom directory (per-site template)
```

---

## East Ponce Village — Current Status

| Component | Status |
|-----------|--------|
| Supabase site row | ✅ Created (slug: `east-ponce-village`) |
| Supabase migrations | ✅ All ran (see below) |
| Pi hardware | ✅ Online at 192.168.26.104 |
| Pi SSH user | `gateguard1` |
| Pi Tailscale hostname | `gatecard-eastponce` (Tailscale authenticated) |
| Pi agent installed | ✅ `/opt/gatecard-agent/` |
| Pi systemd timer | ✅ Enabled, fires daily at 00:30 |
| Pi env file | ✅ `/etc/gatecard-agent.env` — Supabase URL + key + SITE_SLUG set |
| Brivo credentials in Supabase | ✅ Set — 832+ residents syncing hourly |
| E.164 phones in Supabase | ✅ Confirmed |
| **UniFi phone numbers** | ❌ **TODO — run migration + force sync (see below)** |
| **Pinned entries (leasing, EMS)** | ❌ **TODO — run migration 20260506_pinned_residents.sql** |

### UniFi Details (East Ponce)
- Controller: `https://192.168.26.33`
- Local admin: `gatecard-sync`
- Template ID: `4533a662-fef8-4e4c-af6d-9a0a1cebc94c`

---

## 🔴 Action Items Before Next Sync

### 1. Run Migration in Supabase SQL Editor

Go to Supabase → SQL Editor and run:
`supabase/migrations/20260506_pinned_residents.sql`

This does three things:
1. Adds `pinned` boolean column to residents
2. Clears `unifi_directory_id` for all East Ponce residents (forces full recreate with phones)
3. Inserts pinned leasing office + EMS rows

### 2. Fill in Leasing Office Phone

After running the migration, go to Table Editor → residents, find the "Leasing Office" row (pinned=true), and fill in the `phone` field with the leasing office callback number in E.164 format (e.g. `+14045551234`).

The EMS row has no phone by default — EMS uses PIN 8080, not a callback number.

### 3. Set EMS PIN 8080 in UniFi Access

The PIN code is a UniFi Access credential, **not** managed by the sync agent. Configure it directly:
- UniFi Access → Access Users → find EMS user → Credentials → Add PIN → set `8080`
- Or: UniFi Access → Access Policies → add a PIN-based access rule for gate relay

### 4. Force Pi Sync

After the migration and leasing office phone are set, trigger a manual sync:
```bash
sudo systemctl start gatecard-sync.service
sudo tail -f /var/log/gatecard/sync.log
```

This will:
- Delete all 800+ stale phoneless entries in UniFi
- Recreate all residents with their E.164 phone numbers
- Keep the leasing office + EMS pinned entries safe

---

## Architecture Details

### Supabase tables
- `sites` — one row per property, holds all credentials (Brivo, UniFi, EEN)
- `residents` — scoped by `site_id`, unique on `(site_id, brivo_user_id)`, `pinned` column for permanent entries
- `unifi_sync_log` — audit log of every Pi sync run

### Pinned Residents — How They Work
- `pinned = true` rows are NEVER deactivated by the Brivo cron (even if not in Brivo)
- `pinned = true` rows with a `unifi_directory_id` are NEVER deleted by the Pi sync agent
- Pinned rows are created manually in Supabase (or via migration)
- They participate in normal sync (create + update) if they have a phone number

### Key files changed (last two sessions)
| File | What it does |
|------|-------------|
| `app/api/sync/brivo/route.ts` | Calls Brivo per-site, paginates, E.164 phones; skips `pinned=true` during deactivation |
| `app/api/sites/setup/route.ts` | Accepts/stores 4 Brivo credential fields |
| `app/setup-site/page.tsx` | Brivo credentials collapsible section |
| `agent/lib/unifi.js` | `localFetch` uses `https.request` for self-signed cert bypass |
| `agent/lib/supabase.js` | Added `getPinnedResidents()` helper; fetches `pinned` column |
| `agent/sync-agent.js` | Parallel batch sync (CONCURRENCY=15); never deletes pinned entries |
| `agent/setup.sh` | Timer: daily at 00:30 |
| `supabase/migrations/20260506_pinned_residents.sql` | pinned column + clear IDs + insert leasing/EMS rows — **RUN THIS** |

### Vercel crons (vercel.json)
- `/api/sync/brivo` — every hour at :00
- `/api/sync/ubiquiti` — daily at 08:00

### Pi SSH commands
```bash
# SSH in (local)
ssh gateguard1@192.168.26.104

# SSH in (anywhere via Tailscale)
ssh gateguard1@gatecard-eastponce

# Dry run
sudo bash -c 'set -a; . /etc/gatecard-agent.env; set +a; sudo -u gatecard -E node /opt/gatecard-agent/sync-agent.js --dry-run'

# Manual sync
sudo systemctl start gatecard-sync.service

# Check timer
systemctl list-timers gatecard-sync.timer

# Tail logs
sudo tail -f /var/log/gatecard/sync.log
```

---

## Adding a New Site (Repeatable Playbook)

1. **Supabase:** Go to `gatecard.co/setup-site`, fill in all fields including Brivo credentials + UniFi details → Save
2. **UniFi:** Get template ID via browser console on controller: `fetch('/proxy/access/api/v2/templates').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))`
3. **Pi:** Flash Raspberry Pi OS Lite, SSH in, copy agent files, run `sudo bash setup.sh`, fill in `/etc/gatecard-agent.env` with Supabase keys + `SITE_SLUG=`, run dry run
4. **Tailscale:** `sudo tailscale up --hostname=gatecard-{siteslug}`, approve at login.tailscale.com/admin/machines
5. **Pinned entries:** Insert leasing office row (with phone) + any site-specific permanent entries into residents with `pinned=true`
6. **Test:** Run dry run → confirm residents appear → run real sync → check UniFi directory

---

## Brivo API Notes

```
Auth: POST https://auth.brivo.com/oauth/token
  Headers: Authorization: Basic {brivo_auth_basic}
  Body: grant_type=password&username=...&password=...

Users: GET https://api.brivo.com/v1/api/users?pageSize=100&offset=0
  Headers: Authorization: bearer {token}, api-key: {brivo_api_key}
  Response: { data: [{ id, firstName, lastName, phoneNumbers: [{number}], email }] }

Phone field: u.phoneNumbers?.[0]?.number → normalize to E.164
```

Each property = its own Brivo account = its own set of credentials.
