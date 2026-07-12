#!/usr/bin/env bash
# Constella VPS install — native + Tailscale + systemd. NO Docker.
#
# Installs Node >= 20 + the published `constellai` CLI, joins Tailscale on the host, and registers a
# systemd service that runs `constella --vps` (starts on boot, restarts on crash). The server binds
# 0.0.0.0 and is reachable PRIVATELY on your tailnet at :3000.
#
#   curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-install.sh | bash
#
set -euo pipefail

PKG="constellai"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
say() { printf '%s\n' "$*"; }

# The user the service runs as (owns ~/.constella + the agent-CLI auth). Under sudo, the real operator.
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_HOME="$(getent passwd "$RUN_USER" 2>/dev/null | cut -d: -f6)"; [ -n "${RUN_HOME:-}" ] || RUN_HOME="$HOME"
CHOME="${CONSTELLA_HOME:-$RUN_HOME/.constella}"

say "✦ Constella VPS install — native + Tailscale + systemd"

# 1) Node >= 20 (better-sqlite3/sharp ship prebuilt binaries; build tools are a fallback).
ensure_node() {
  local major=0
  command -v node >/dev/null 2>&1 && major="$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')"
  if [ "${major:-0}" -ge 20 ] 2>/dev/null; then return 0; fi
  say "• Installing Node 22 (>= 20 required)…"
  if   command -v apt-get >/dev/null 2>&1; then curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - && $SUDO apt-get install -y nodejs
  elif command -v dnf     >/dev/null 2>&1; then $SUDO dnf install -y nodejs npm gcc-c++ make python3
  elif command -v pacman  >/dev/null 2>&1; then $SUDO pacman -S --needed --noconfirm nodejs npm base-devel python
  else say "✖ Couldn't auto-install Node. Install Node >= 20 manually, then re-run."; exit 1
  fi
}
ensure_node
if ! { command -v make >/dev/null 2>&1 && { command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1; }; }; then
  command -v apt-get >/dev/null 2>&1 && { $SUDO apt-get update -y >/dev/null 2>&1 || true; $SUDO apt-get install -y build-essential python3 ripgrep >/dev/null 2>&1 || true; }
fi

# 2) The Constella CLI.
say "• Installing the ${PKG} CLI…"
$SUDO npm install -g "$PKG"
# The service MUST run the binary that `sudo npm i -g` installs/updates — NOT whatever `command -v constella`
# resolves first on the operator's PATH. An earlier user-level `npm i -g` (into ~/.npm-global) shadows it, so
# ExecStart would pin THAT copy and every future `sudo npm i -g` (in-app update, vps-update.sh) would update a
# different prefix → "updated, but the app still shows the old version". Pin ExecStart to sudo's global prefix.
NPM_PREFIX="$($SUDO npm config get prefix 2>/dev/null)"; [ -n "$NPM_PREFIX" ] || NPM_PREFIX="/usr/local"
BIN="${NPM_PREFIX}/bin/constella"
[ -x "$BIN" ] || BIN="$(command -v constella || echo "$BIN")"
say "  → service binary: ${BIN}  (global prefix ${NPM_PREFIX})"

# Absolute npm/systemctl paths — passed to the in-app self-updater via the service env AND used in the sudoers
# rule below, so `sudo -n` matches the NOPASSWD entry regardless of how sudo's secure_path resolves a bare name.
NPM_PATH="$(command -v npm || echo "${NPM_PREFIX}/bin/npm")"
SYSTEMCTL_PATH="$(command -v systemctl || echo /usr/bin/systemctl)"

# Agent CLIs (claude / codex / …) install into per-USER bin dirs (~/.local/bin, ~/.npm-global/bin, the claude
# native install) that systemd's minimal PATH does NOT include — so the service couldn't run them: the onboarding
# "detected providers" missed Claude Code, and real agent runs would fail to spawn the CLI. Bake a PATH that
# covers the common locations + the installer's own PATH so the service sees exactly what your shell does.
NPM_BIN="${NPM_PREFIX}/bin"
SVC_PATH="${RUN_HOME}/.local/bin:${RUN_HOME}/.npm-global/bin:${NPM_BIN}:${RUN_HOME}/.claude/local:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

# 3) Tailscale on the host (the host IS the tailnet node — no sidecar, no auth key prompt).
if ! command -v tailscale >/dev/null 2>&1; then
  say "• Installing Tailscale…"; curl -fsSL https://tailscale.com/install.sh | $SUDO sh
fi
say "• Joining your tailnet (a browser auth URL prints if this host isn't joined yet)…"
$SUDO tailscale up || true

# 4) systemd service — runs `constella --vps` on boot, restarts on crash. CONSTELLA_SKIP_TAILSCALE=1
#    because step 3 already joined the tailnet (the launcher won't re-run `tailscale up`).
say "• Registering the systemd service (constella.service)…"
$SUDO tee /etc/systemd/system/constella.service >/dev/null <<EOF
[Unit]
Description=Constella
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Environment=CONSTELLA_RUN_MODE=vps
Environment=CONSTELLA_HOME=${CHOME}
Environment=CONSTELLA_SKIP_TAILSCALE=1
Environment=PATH=${SVC_PATH}
Environment=CONSTELLA_NPM_PATH=${NPM_PATH}
Environment=CONSTELLA_SYSTEMCTL_PATH=${SYSTEMCTL_PATH}
ExecStart=${BIN} --vps --host 0.0.0.0 --port 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now constella

# 4b) Passwordless self-update. The service runs as a NON-root user, so it can't touch the root-owned global
#     package or `systemctl` by itself — the in-app "Update now" button would stall waiting for a password.
#     Drop a TIGHTLY-SCOPED /etc/sudoers.d/constella granting NOPASSWD for EXACTLY two commands: install the
#     package and restart the unit. Nothing else. Validated with `visudo -c` before it's installed (a malformed
#     sudoers file would lock out sudo), and skipped gracefully if validation fails.
say "• Enabling passwordless self-update (sudoers.d/constella)…"
# visudo lives in /usr/sbin, which is NOT on a non-root user's PATH (this script may run as the operator via
# `curl | bash`). Resolve it explicitly and validate THROUGH sudo so it's both found and privileged.
VISUDO="$(command -v visudo || echo /usr/sbin/visudo)"
SUDOERS_TMP="$(mktemp)"
# EXACT commands only — `constellai@latest` (the in-app button always installs latest), not a trailing `@*`
# wildcard whose `*` can span whitespace and absorb extra npm flags under root.
cat > "$SUDOERS_TMP" <<EOF
# Constella self-update - managed by scripts/vps-install.sh. Lets ${RUN_USER} update Constella and restart
# its service without a password (the in-app Update button + scripts/vps-update.sh). Scoped to two commands.
${RUN_USER} ALL=(root) NOPASSWD: ${NPM_PATH} install -g constellai, ${NPM_PATH} install -g constellai@latest, ${SYSTEMCTL_PATH} restart constella, ${SYSTEMCTL_PATH} restart constella.service
EOF
if $SUDO "$VISUDO" -cf "$SUDOERS_TMP" >/dev/null 2>&1; then
  $SUDO install -m 0440 -o root -g root "$SUDOERS_TMP" /etc/sudoers.d/constella
  say "  ✓ One-click updates enabled — the Update module can install + restart on its own."
else
  say "  • Skipped (sudoers validation failed) — in-app VPS updates will fall back to the shell command."
fi
rm -f "$SUDOERS_TMP"

# 5) Reach URL = the host's tailnet IP.
sleep 2
IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
say ""
say "✓ Constella is running as a systemd service (starts on boot, restarts on crash)."
say "  Reach it on your tailnet:  http://${IP:-<host-tailnet-ip>}:3000   (run: tailscale ip -4)"
say "  Manage:  systemctl status constella   ·   journalctl -u constella -f   ·   systemctl restart constella"
say "  First load → /login (login is enforced in VPS mode)."
