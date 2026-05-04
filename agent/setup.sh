#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GateCard Pi Sync Agent — Setup Script
#
# Installs and configures:
#   1. Node.js 18 LTS
#   2. Sync agent (this repo's agent/ folder)
#   3. Systemd timer — runs sync at :30 past 0h/6h/12h/18h
#   4. Tailscale — remote SSH access from anywhere (no port forwarding needed)
#
# Run as root on a fresh Raspberry Pi OS Lite (64-bit):
#   sudo bash setup.sh
#
# After running, configure /etc/gatecard-agent.env with real secrets,
# then: sudo systemctl start gatecard-sync.service
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

AGENT_USER="gatecard"
AGENT_DIR="/opt/gatecard-agent"
ENV_FILE="/etc/gatecard-agent.env"
LOG_DIR="/var/log/gatecard"
SERVICE_NAME="gatecard-sync"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
check() { echo -e "${GREEN}[setup]${NC} ✓ $*"; }

# ─── 0. Must be root ─────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash setup.sh"
  exit 1
fi

info "GateCard Pi sync agent setup starting…"

# ─── 1. System update ────────────────────────────────────────────────────────

info "Updating system packages…"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git jq
check "System packages up to date"

# ─── 2. Node.js 18 LTS ───────────────────────────────────────────────────────

if node --version 2>/dev/null | grep -q "^v18\|^v20\|^v22"; then
  check "Node.js already installed: $(node --version)"
else
  info "Installing Node.js 18 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y -qq nodejs
  check "Node.js installed: $(node --version)"
fi

# ─── 3. Create agent user ─────────────────────────────────────────────────────

if id "$AGENT_USER" &>/dev/null; then
  check "User '$AGENT_USER' already exists"
else
  info "Creating system user '$AGENT_USER'…"
  useradd --system --no-create-home --shell /bin/false "$AGENT_USER"
  check "User '$AGENT_USER' created"
fi

# ─── 4. Install agent files ───────────────────────────────────────────────────

info "Installing agent to $AGENT_DIR…"

mkdir -p "$AGENT_DIR"

# Copy agent files from the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp -r "$SCRIPT_DIR/." "$AGENT_DIR/"
chown -R "$AGENT_USER:$AGENT_USER" "$AGENT_DIR"
chmod -R 750 "$AGENT_DIR"

# Install npm dependencies
info "Installing npm dependencies…"
cd "$AGENT_DIR"
sudo -u "$AGENT_USER" npm install --omit=dev --silent
cd - > /dev/null

check "Agent installed at $AGENT_DIR"

# ─── 5. Log directory ─────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"
chown "$AGENT_USER:$AGENT_USER" "$LOG_DIR"
check "Log directory: $LOG_DIR"

# ─── 6. Environment file ──────────────────────────────────────────────────────

if [[ -f "$ENV_FILE" ]]; then
  warn "Environment file already exists at $ENV_FILE — skipping (edit manually)"
else
  info "Creating environment file template at $ENV_FILE…"
  cat > "$ENV_FILE" <<'EOF'
# GateCard Pi Sync Agent — Environment Variables
# Fill in the values below, then restart the service.

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SITE_SLUG=your-property-slug
LOG_LEVEL=
EOF
  chmod 600 "$ENV_FILE"         # Readable only by root
  chown root:root "$ENV_FILE"
  warn "⚠  Fill in $ENV_FILE with real values before starting the service!"
fi

# ─── 7. Systemd service ───────────────────────────────────────────────────────

info "Installing systemd service…"

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=GateCard UniFi Sync Agent
Documentation=https://github.com/your-org/gatecard.co
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=${AGENT_USER}
WorkingDirectory=${AGENT_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${AGENT_DIR}/sync-agent.js
StandardOutput=append:${LOG_DIR}/sync.log
StandardError=append:${LOG_DIR}/sync-error.log
TimeoutStartSec=300

# Restart on failure (for the oneshot timer use case)
Restart=no
EOF

# ─── 8. Systemd timer (runs daily at 00:30) ──────────────────────────────────

cat > "/etc/systemd/system/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=GateCard UniFi Sync — daily at 00:30
Documentation=https://github.com/your-org/gatecard.co

[Timer]
# 00:30 daily — 30 min after Vercel's Brivo cron (:00) so Supabase is fresh
OnCalendar=*-*-* 00:30:00
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.timer"
systemctl start  "${SERVICE_NAME}.timer"

check "Systemd timer enabled: $(systemctl is-enabled ${SERVICE_NAME}.timer)"

# ─── 9. Log rotation ──────────────────────────────────────────────────────────

cat > "/etc/logrotate.d/gatecard-agent" <<EOF
${LOG_DIR}/*.log {
  daily
  rotate 30
  compress
  missingok
  notifempty
  copytruncate
}
EOF
check "Log rotation configured"

# ─── 10. Tailscale (remote SSH access) ───────────────────────────────────────
#
# Tailscale gives you secure SSH access to this Pi from anywhere —
# your laptop, phone, or another server — without opening any firewall ports.
#
# How it works: Pi connects OUT to Tailscale's relay. You connect via
# your Tailscale-enrolled device. Fully encrypted. Free for teams < 3 devices
# (use the personal plan or the team plan for multiple properties).
#
# After setup: ssh pi@gatecard-{site-slug} from any Tailscale device.

info "Installing Tailscale for remote access…"

if command -v tailscale &>/dev/null; then
  check "Tailscale already installed: $(tailscale version | head -1)"
else
  curl -fsSL https://tailscale.com/install.sh | sh
  check "Tailscale installed"
fi

# Enable SSH via Tailscale (allows key-based SSH without a public IP)
systemctl enable --now tailscaled

warn "─────────────────────────────────────────────────────────────────────"
warn "Tailscale installed but NOT yet authenticated."
warn ""
warn "To complete setup, run:"
warn "  sudo tailscale up --hostname=gatecard-\$(hostname)"
warn ""
warn "Then approve the device at: https://login.tailscale.com/admin/machines"
warn ""
warn "After approval, SSH from anywhere with:"
warn "  ssh pi@gatecard-\$(hostname)"
warn "─────────────────────────────────────────────────────────────────────"

# ─── 11. SSH hardening (while we're here) ────────────────────────────────────

info "Hardening SSH config…"

# Disable password auth — key-based only (safer for a property-deployed device)
# Comment out and re-enable if you need password access during setup
if grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
  sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload sshd
  warn "Password SSH auth disabled — use key-based auth or Tailscale SSH"
fi

check "SSH hardening applied"

# ─── 12. Summary ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} GateCard Pi Setup Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Fill in secrets:"
echo "     sudo nano $ENV_FILE"
echo ""
echo "  2. Authenticate Tailscale (remote access):"
echo "     sudo tailscale up --hostname=gatecard-\$(hostname)"
echo "     Approve at: https://login.tailscale.com/admin/machines"
echo ""
echo "  3. Test sync (dry run first):"
echo "     sudo -u $AGENT_USER node $AGENT_DIR/sync-agent.js --dry-run"
echo ""
echo "  4. Run sync manually:"
echo "     sudo systemctl start ${SERVICE_NAME}.service"
echo "     sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "  5. Check timer schedule:"
echo "     systemctl list-timers ${SERVICE_NAME}.timer"
echo ""
echo "  Logs:     $LOG_DIR/"
echo "  Env file: $ENV_FILE"
echo "  Agent:    $AGENT_DIR/"
echo ""
