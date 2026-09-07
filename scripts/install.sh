#!/usr/bin/env bash
# Constella installer — ONE command per mode. Fetch + run straight from the public repo:
#
#   curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/install.sh | bash -s -- --vps
#   curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/install.sh | bash -s -- --start
#   ... -- --portable | --update | --uninstall | --clean
#
# --vps      : native install — Node + the `constellai` CLI + Tailscale + a systemd service (no Docker).
# --start/--portable : ensures Node, installs the `constellai` CLI globally, then starts the server.
# --update   : updates in place (VPS systemd -> vps-update.sh; otherwise npm). Data in ~/.constella is kept.
# --uninstall: removes the CLI (data in ~/.constella is kept unless you delete it).
# --clean    : wipe a VPS to a clean slate (Constella data) — KEEPS Tailscale (vps-clean.sh).
set -euo pipefail

PKG="constellai"                                   # npm package name (the CLI command is `constella`)
REPO="https://github.com/gabriel7silva/constella.git"
RAW="https://raw.githubusercontent.com/gabriel7silva/constella/main"
DIR="${CONSTELLA_DIR:-$HOME/constella}"            # where --vps clones the repo
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
MODE="${1:-}"

say() { printf '%s\n' "$*"; }

ensure_node() {
  local major=0
  command -v node >/dev/null 2>&1 && major="$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')"
  if [ "${major:-0}" -ge 20 ] 2>/dev/null; then return 0; fi
  say "• Installing Node 22 (>= 20 required)…"
  if   command -v apt-get >/dev/null 2>&1; then curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - && $SUDO apt-get install -y nodejs
  elif command -v dnf     >/dev/null 2>&1; then $SUDO dnf install -y nodejs npm gcc-c++ make python3
  elif command -v pacman  >/dev/null 2>&1; then $SUDO pacman -S --needed --noconfirm nodejs npm base-devel python
  elif command -v brew    >/dev/null 2>&1; then brew install node
  else say "✖ Couldn't auto-install Node. Install Node >= 20 manually, then re-run."; exit 1
  fi
}

ensure_build_tools() {
  # better-sqlite3 / sharp ship prebuilt binaries for common Node versions; on a very new Node (e.g.
  # 24) with no matching prebuild, npm compiles them — which needs make + a C/C++ compiler. Install
  # the toolchain best-effort on Linux so a global install doesn't die with "not found: make".
  if command -v make >/dev/null 2>&1 && { command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1; }; then return 0; fi
  say "• Installing native build tools (better-sqlite3 needs them when there's no prebuilt binary)…"
  if   command -v apt-get >/dev/null 2>&1; then $SUDO apt-get update -y >/dev/null 2>&1 || true; $SUDO apt-get install -y build-essential python3 || true
  elif command -v dnf     >/dev/null 2>&1; then $SUDO dnf install -y gcc-c++ make python3 || true
  elif command -v pacman  >/dev/null 2>&1; then $SUDO pacman -S --needed --noconfirm base-devel python || true
  fi
}

case "$MODE" in
  --vps)
    # Native: hand off to the bootstrap (installs Node + the CLI, joins Tailscale, registers the
    # systemd service). No Docker, no repo clone.
    exec bash -c "curl -fsSL '$RAW/scripts/vps-install.sh' | bash"
    ;;

  --start|--auth|--portable)
    ensure_node
    ensure_build_tools
    say "• Installing the ${PKG} CLI globally…"
    $SUDO npm install -g "$PKG"
    say "✓ Installed. The command is: constella ${MODE}"
    # A piped install (curl | bash) has no TTY, so onboarding/USB prompts can't run — instruct instead.
    if [ -t 0 ] && [ -t 1 ]; then exec constella "$MODE"
    else say ""; say "  Run it now:  constella ${MODE}"; fi
    ;;

  --update)
    if systemctl list-unit-files 2>/dev/null | grep -q '^constella\.service'; then
      # VPS: update the global CLI + restart the systemd service. Pass $RAW + the version as POSITIONAL args
      # to the inner shell (not interpolated into the command string) so a version with shell-special chars
      # can't word-split or inject.
      exec bash -c 'curl -fsSL "$1/scripts/vps-update.sh" | bash -s -- "${2:-latest}"' _ "$RAW" "${2:-}"
    else
      ensure_node; $SUDO npm install -g "${PKG}@${2:-latest}"; say "✓ Updated. Relaunch:  constella --start   (or --vps / --portable)"
    fi
    ;;

  --uninstall)
    $SUDO npm uninstall -g "$PKG" 2>/dev/null || true
    say "✓ Removed the ${PKG} CLI."
    say "  Your data is still in ~/.constella — delete it to wipe everything:  rm -rf ~/.constella"
    ;;

  --clean)
    # Wipe a VPS back to a clean slate (systemd service + Constella data), keeping Tailscale.
    exec bash -c "curl -fsSL '$RAW/scripts/vps-clean.sh' | bash -s -- ${2:-}"
    ;;

  ""|-h|--help)
    say "Constella installer"
    say "  curl -fsSL <raw>/scripts/install.sh | bash -s -- <flag>"
    say "Flags: --start  --vps  --portable   |   --update [version]   --uninstall   --clean"
    ;;
  *)
    say "✖ Unknown option: $MODE"
    say "  Use one of: --start --vps --portable --update --uninstall --clean"
    exit 1
    ;;
esac
