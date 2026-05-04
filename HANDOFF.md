# GateCard — Session Handoff Notes
_Last updated: May 4, 2026_

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
| Supabase migration (unifi_template_id) | ✅ Ran |
| Supabase migration (brivo credentials columns) | ✅ Ran |
| Pi hardware | ✅ Online at 192.168.26.104 |
| Pi SSH user | `gateguard1` |
| Pi Tailscale hostname | `gatecard-eastponce` (Tailscale authenticated) |
| Pi agent installed | ✅ `/opt/gatecard-agent/` |
| Pi systemd timer | ✅ Enabled, fires daily at 00:30 |
| Pi env file | ✅ `/etc/gatecard-agent.env` — Supabase URL + key + SITE_SLUG set |
| Dry run | ✅ Passes — connects to Supabase and UniFi controller |
| **Brivo credentials in Supabase** | ❌ **TODO — needed to pull residents** |

### UniFi Details (East Ponce)
- Controller: `https://192.168.26.33`
- Local admin: `gatecard-sync`
- Template ID: `4533a662-fef8-4e4c-af6d-9a0a1cebc94c`
- UniFi directory currently has 4 test entries (Jane Doer, John Doe, Russel Feldman, wayne some) — these will be replaced on first real sync

---

## ❌ Blocking Item — Brivo Credentials for East Ponce

The hourly Brivo cron skips sites with no credentials. East Ponce needs these 4 fields set in the Supabase `sites` table:

| Column | Where to find it |
|--------|-----------------|
| `brivo_api_key` | developer.brivo.com → your app → API Keys |
| `brivo_auth_basic` | Base64 of `client_id:client_secret` — run: `echo -n "client_id:client_secret" \| base64` |
| `brivo_username` | Brivo admin login email for East Ponce account |
| `brivo_password` | Brivo admin password for East Ponce account |

**Note:** Brivo needs to enable API access for the East Ponce account first (user said "need something enabled from Brivo" — waiting on that).

**Once credentials are ready:**
1. Go to Supabase → Table Editor → `sites` → find `east-ponce-village` row
2. Edit the 4 brivo columns directly
3. The next hourly cron run will pull residents automatically
4. Residents with phone numbers will flow to UniFi at 00:30

---

## Architecture Details

### Supabase tables
- `sites` — one row per property, holds all credentials (Brivo, UniFi, EEN)
- `residents` — scoped by `site_id`, unique on `(site_id, brivo_user_id)`
- `unifi_sync_log` — audit log of every Pi sync run

### Key files changed this session
| File | What it does |
|------|-------------|
| `app/api/sync/brivo/route.ts` | Rewritten — calls Brivo directly per-site using stored credentials, paginates users, maps `phoneNumbers[0].number` |
| `app/api/sites/setup/route.ts` | Updated — now accepts/stores 4 Brivo credential fields |
| `app/setup-site/page.tsx` | Updated — Brivo credentials collapsible section added |
| `agent/lib/unifi.js` | Rewritten — `localFetch` now uses `https.request` so self-signed cert bypass actually works |
| `agent/setup.sh` | Timer changed to daily at 00:30 |
| `supabase/migrations/20260504_unifi_template_id.sql` | Adds `unifi_template_id` column — RAN ✅ |
| `supabase/migrations/20260504_brivo_credentials.sql` | Adds 4 Brivo credential columns — RAN ✅ |

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
5. **Test:** Run dry run → confirm residents appear → run real sync → check UniFi directory

---

## Brivo API Notes (from Stonegate codebase)

```
Auth: POST https://auth.brivo.com/oauth/token
  Headers: Authorization: Basic {brivo_auth_basic}
  Body: grant_type=password&username=...&password=...

Users: GET https://api.brivo.com/v1/api/users?pageSize=100&offset=0
  Headers: Authorization: bearer {token}, api-key: {brivo_api_key}
  Response: { data: [{ id, firstName, lastName, phoneNumbers: [{number}], email }] }

Phone field: u.phoneNumbers?.[0]?.number
```

Each property = its own Brivo account = its own set of credentials.
