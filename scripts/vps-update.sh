#!/usr/bin/env bash
# Constella VPS updater — native. Updates the global `constellai` CLI and restarts the systemd service.
# NO Docker. Your data in ~/.constella (DB, secrets, workspaces) is preserved; migrations run on boot.
#
#   bash scripts/vps-update.sh            # -> latest published version on npm
#   bash scripts/vps-update.sh 0.2.30     # -> a specific version
#
set -euo pipefail

PKG="constellai"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
say() { printf '%s\n' "$*"; }
VERSION="${1:-latest}"

# The user the service runs as (owns ~/.constella). Under sudo, the real operator.
RUN_USER="${SUDO_USER:-$(id -un)}"

say "• Installing ${PKG}@${VERSION}…"
# Install into the SAME prefix the systemd service actually runs from — not npm's default. If an earlier
# user-level `npm i -g` shadowed the binary, the service's ExecStart may point at a different prefix; a plain
# `npm i -g` would update the wrong copy and the app would keep showing the old version after a restart.
SVC_BIN="$(systemctl cat constella 2>/dev/null | sed -n 's/^ExecStart=//p' | head -1 | awk '{print $1}')"
if [ -n "${SVC_BIN:-}" ] && [ -x "$SVC_BIN" ]; then
  SVC_PREFIX="$(dirname "$(dirname "$SVC_BIN")")"
  say "  → service runs ${SVC_BIN} — installing into prefix ${SVC_PREFIX}"
  $SUDO npm install -g --prefix "$SVC_PREFIX" "${PKG}@${VERSION}"
else
  $SUDO npm install -g "${PKG}@${VERSION}"
fi

# (Re)write the passwordless self-update drop-in EVERY run (not just when absent) — an older/malformed/wrong-path
# drop-in left by a previous installer must be REPAIRED, else the in-app "Update now" keeps failing `sudo -n`
# with no self-heal. Idempotent + validated with visudo before install so a bad file can never lock out sudo.
NPM_PATH="$(command -v npm || echo /usr/bin/npm)"
SYSTEMCTL_PATH="$(command -v systemctl || echo /usr/bin/systemctl)"
# visudo is in /usr/sbin (off a non-root PATH) — resolve it and validate through sudo so it's found + privileged.
VISUDO="$(command -v visudo || echo /usr/sbin/visudo)"
SUDOERS_TMP="$(mktemp)"
# EXACT `constellai@latest` (no trailing `@*` wildcard that could span whitespace into extra root npm flags).
cat > "$SUDOERS_TMP" <<EOF
# Constella self-update - managed by scripts/vps-update.sh. Lets ${RUN_USER} update Constella and restart its
# service without a password (the in-app Update button). Scoped to two commands.
${RUN_USER} ALL=(root) NOPASSWD: ${NPM_PATH} install -g constellai, ${NPM_PATH} install -g constellai@latest, ${SYSTEMCTL_PATH} restart constella, ${SYSTEMCTL_PATH} restart constella.service
EOF
if $SUDO "$VISUDO" -cf "$SUDOERS_TMP" >/dev/null 2>&1; then
  $SUDO install -m 0440 -o root -g root "$SUDOERS_TMP" /etc/sudoers.d/constella
  say "• Enabled passwordless one-click updates (sudoers.d/constella)."
fi
rm -f "$SUDOERS_TMP"

if systemctl list-unit-files 2>/dev/null | grep -q '^constella\.service'; then
  say "• Restarting the constella service…"
  $SUDO systemctl restart constella
else
  say "• No systemd service found — relaunch manually:  constella --vps"
fi

IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
say ""
say "✓ Constella updated (${VERSION}) and restarted. Data in ~/.constella preserved."
say "  Reach it at:  http://${IP:-<host-tailnet-ip>}:3000   ·   logs: journalctl -u constella -f"
