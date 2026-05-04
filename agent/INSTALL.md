# GateCard Pi Sync Agent — Installation Guide

One Raspberry Pi 4 per property. Sits in the IT closet, talks to Supabase (cloud) and the UniFi Access controller (local LAN). No open firewall ports required.

---

## Hardware

| Item | Spec | Where |
|---|---|---|
| Raspberry Pi 4 Model B | 2GB RAM | Micro Center / Best Buy / Amazon |
| MicroSD card | 16GB, A1/Class 10 (SanDisk) | Any electronics store |
| USB-C power adapter | 5V/3A | Included in starter kits |
| Ethernet cable | Any length | On-site or bring one |
| Case (optional) | Any Pi 4 case | Amazon |

**Starter kit option:** CanaKit Raspberry Pi 4 Starter Kit (~$80) includes board, SD card, power adapter, and case.

---

## Step 1 — Flash the OS

1. Download **Raspberry Pi Imager** from [raspberrypi.com/software](https://www.raspberrypi.com/software/)
2. Insert the MicroSD card into your laptop
3. In Imager, choose:
   - **Device:** Raspberry Pi 4
   - **OS:** Raspberry Pi OS Lite (64-bit) — no desktop needed
   - **Storage:** your MicroSD card
4. Click the gear icon (⚙) **before** writing:
   - ✅ Set hostname: `gatecard-[property-slug]` e.g. `gatecard-stonegate`
   - ✅ Enable SSH → Use password authentication (you'll disable password auth after setup)
   - ✅ Set username: `pi` / set a strong password
   - ✅ Configure WiFi if no ethernet available: enter property WiFi SSID + password
5. Write the card — takes ~3 minutes

---

## Step 2 — First Boot

1. Insert SD card into Pi, connect ethernet, plug in power
2. Wait ~60 seconds for first boot
3. Find the Pi's IP from your router's DHCP table, or use:
   ```
   ping gatecard-stonegate.local
   ```
4. SSH in from your laptop:
   ```bash
   ssh pi@gatecard-stonegate.local
   # or: ssh pi@192.168.x.x
   ```

---

## Step 3 — Copy Agent Files

On your laptop, from the `gatecard.co` repo root:

```bash
scp -r agent/ pi@gatecard-stonegate.local:/home/pi/gatecard-agent
```

Or clone the repo directly on the Pi:

```bash
# On the Pi:
git clone https://github.com/your-org/gatecard.co.git
cd gatecard.co/agent
```

---

## Step 4 — Run Setup Script

```bash
# On the Pi:
cd /home/pi/gatecard-agent   # or ~/gatecard.co/agent
sudo bash setup.sh
```

The script installs Node.js 18, copies the agent to `/opt/gatecard-agent`, sets up the systemd timer, and installs Tailscale. Takes about 2–3 minutes.

---

## Step 5 — Configure Secrets

```bash
sudo nano /etc/gatecard-agent.env
```

Fill in:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # from Supabase → Project Settings → API
SITE_SLUG=stonegate                 # must match sites.slug in your DB
LOG_LEVEL=                          # leave blank in production
```

Save and exit (`Ctrl+X → Y → Enter`).

> **Security note:** The env file is `chmod 600` — only root can read it. The agent runs as the `gatecard` system user which has no shell access.

---

## Step 6 — Add Site to Supabase

In Supabase → Table Editor → `sites`, add the UniFi credentials to the property's row:

| Column | Value |
|---|---|
| `unifi_controller_url` | `https://192.168.1.1` (controller IP on LAN) |
| `unifi_local_username` | local admin username |
| `unifi_local_password` | local admin password |

> **Local admin setup:** In UniFi OS → Settings → Admins & Users → Add Admin → choose **"Local Access Only"** (not UI.com account). Give it a strong password. This account bypasses MFA and is only used by the Pi agent.

---

## Step 7 — Test with Dry Run

```bash
sudo -u gatecard node /opt/gatecard-agent/sync-agent.js --dry-run
```

This shows exactly what would be added, updated, and deleted — without touching UniFi. Verify the output looks right before running for real.

---

## Step 8 — Run First Sync

```bash
sudo systemctl start gatecard-sync.service
```

Watch the output:
```bash
sudo journalctl -u gatecard-sync -f
# or:
tail -f /var/log/gatecard/sync.log
```

---

## Step 9 — Set Up Tailscale (Remote Access)

Tailscale lets you SSH into this Pi from anywhere — your laptop, your phone, another server — without opening any firewall ports at the property.

```bash
# On the Pi:
sudo tailscale up --hostname=gatecard-stonegate
```

It prints a URL. Open it on your phone/laptop to approve the device:
```
https://login.tailscale.com/admin/machines
```

After approval, from any device enrolled in your Tailscale account:
```bash
ssh pi@gatecard-stonegate
```

> **Cost:** Tailscale is free for up to 100 devices with a personal account. For a team, the Starter plan is $6/month for 3 users + unlimited devices.

---

## Day-to-Day Operations

### Check timer schedule
```bash
systemctl list-timers gatecard-sync.timer
# Shows: next run, last run, time since last run
```

### Manually trigger a sync
```bash
sudo systemctl start gatecard-sync.service
```

### View logs
```bash
tail -100 /var/log/gatecard/sync.log        # last 100 lines
tail -f /var/log/gatecard/sync-error.log    # errors live
journalctl -u gatecard-sync --since today   # systemd journal
```

### List current UniFi directory
```bash
sudo -u gatecard node /opt/gatecard-agent/sync-agent.js --list
```

### Sync one site only
```bash
sudo -u gatecard node /opt/gatecard-agent/sync-agent.js --site=stonegate
```

### Update the agent
```bash
# Pull latest code from repo on your laptop, then:
scp -r agent/ pi@gatecard-stonegate:/home/pi/gatecard-agent-new
sudo cp -r /home/pi/gatecard-agent-new/* /opt/gatecard-agent/
cd /opt/gatecard-agent && sudo -u gatecard npm install --omit=dev
sudo systemctl restart gatecard-sync.timer
```

---

## Remote Management via Tailscale

Once Tailscale is set up on the Pi and your work laptop:

```bash
# SSH from anywhere
ssh pi@gatecard-stonegate

# Copy files
scp somefile.js pi@gatecard-stonegate:/opt/gatecard-agent/

# Run commands
ssh pi@gatecard-stonegate "sudo systemctl start gatecard-sync.service"
```

For a fleet of properties, name each Pi clearly:
- `gatecard-stonegate`
- `gatecard-lakewood`
- `gatecard-maplegrove`

All appear in your Tailscale admin dashboard at `login.tailscale.com/admin/machines`.

---

## Troubleshooting

### "UniFi login failed (401)"
- Wrong username/password in `unifi_local_username` / `unifi_local_password`
- Make sure you created a **local** admin account in UniFi OS, not a UI.com SSO account
- Verify the controller URL is correct and reachable from the Pi: `curl -k https://192.168.1.1/api/auth/login`

### "getActiveSites failed"
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in `/etc/gatecard-agent.env`
- Make sure `unifi_controller_url` is set on the site row in Supabase

### Sync runs but nothing changes
- Check `residents` table — are there rows with `active = true` and a `phone` value?
- Run with `--dry-run` and check output for skipped count

### Pi not reachable via Tailscale
- SSH in locally: `ssh pi@192.168.x.x`
- Check Tailscale status: `tailscale status`
- Re-authenticate if needed: `sudo tailscale up`

### Timer not firing
```bash
systemctl status gatecard-sync.timer
journalctl -u gatecard-sync -n 50
```
