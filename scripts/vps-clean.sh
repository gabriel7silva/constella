#!/usr/bin/env bash
#
# vps-clean.sh — wipe a Constella VPS back to a CLEAN SLATE, keeping Tailscale. NO Docker.
#
# Removes: the constella systemd service, the global `constellai` CLI, the runtime data (~/.constella),
# and the npx cache. KEEPS: the host Tailscale install + your tailnet session (so an SSH-over-tailnet
# connection survives). Use it to simulate a fresh install before re-running the VPS install.
#
# Run on the VPS (NOT your laptop):
#   curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash
#   # non-interactive (no prompt):
#   curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash -s -- --yes
#
set -u

PKG="constellai"
HOME_DIR="${CONSTELLA_HOME:-$HOME/.constella}"   # the runtime root (DB, secrets, workspaces)
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"
say() { printf '%s\n' "$*"; }

ASSUME_YES=0
for a in "$@"; do { [ "$a" = "--yes" ] || [ "$a" = "-y" ]; } && ASSUME_YES=1; done

say "This will PERMANENTLY remove from this host:"
say "  • the constella systemd service"
say "  • the Constella runtime data: $HOME_DIR  (operator account, orgs, workspaces)"
say "  • the global '$PKG' CLI and the npx cache"
say "It KEEPS Tailscale (the host install + your tailnet session) untouched."
say ""
if [ "$ASSUME_YES" -ne 1 ]; then
  if [ -e /dev/tty ]; then
    printf 'Type "clean" to proceed: '
    read -r ANS < /dev/tty || ANS=""
    [ "$ANS" = "clean" ] || { say "Aborted."; exit 1; }
  else
    say "Non-interactive shell — re-run with --yes to confirm. Aborted."; exit 1
  fi
fi

# 1) Stop + remove the systemd service.
if systemctl list-unit-files 2>/dev/null | grep -q '^constella\.service'; then
  say "• Stopping + removing the constella systemd service…"
  $SUDO systemctl disable --now constella || say "  ⚠ disable failed — removing the unit anyway; the daemon-reload below clears any dangling .wants symlink."
  $SUDO rm -f /etc/systemd/system/constella.service
  $SUDO systemctl daemon-reload 2>/dev/null
else
  say "• No constella systemd service — skipping."
fi

# 2) Remove the CLI + the runtime data for a true clean slate.
say "• Removing Constella data + CLI…"
$SUDO npm rm -g "$PKG" 2>/dev/null || true
rm -rf "$HOME_DIR"
rm -rf "$HOME/.npm/_npx"

# 3) Verify Tailscale survived.
say ""
say "✓ Clean slate. Tailscale check:"
if command -v tailscale >/dev/null 2>&1; then
  tailscale version 2>/dev/null | head -1
  tailscale ip -4 2>/dev/null | head -1
else
  say "  ! Tailscale not found on PATH — it may not have been installed on the host."
fi
say ""
say "Reinstall fresh with:   npx constellai --vps"
