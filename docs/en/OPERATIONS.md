[← Docs index](./README.md) · [🇧🇷 Português](../pt/OPERATIONS.md) · [✦ Constella](../../README.md)

# 🛠️ Operations — running the ship day to day

![](../assets/divider-orbit.svg)

Once Constella is installed, this is your command deck: how to **start, stop, restart, check status, read logs, update, roll back, uninstall and diagnose** — for both a **local** global install and a **VPS** native deployment. For getting it installed in the first place, see [INSTALLATION](./INSTALLATION.md).

> **Two runtimes, two command sets.** A local install is driven by the `constella` CLI in the foreground; a VPS is a native install on the host — the published npm package + Tailscale + a `systemd` service, managed with `systemctl`. No Docker anywhere. Pick the column that matches your deployment.

---

## Cheat sheet

| Action | Local (global install) | VPS (native: npm + Tailscale + systemd) |
| --- | --- | --- |
| **Start** | `constella --<flag>` | `systemctl start constella` |
| **Stop** | `Ctrl-C` (foreground) / kill the process | `systemctl stop constella` |
| **Restart** | re-run `constella --<flag>` | `systemctl restart constella` |
| **Status** | `constella update --check`; is the port listening? | `systemctl status constella` |
| **Logs** | stdout/stderr of the foreground process | `journalctl -u constella -f` |
| **Update** | `npm install -g constellai@latest` | `curl -fsSL …/scripts/vps-update.sh \| bash` |
| **Rollback** | `npm install -g constellai@<old>` | `curl -fsSL …/scripts/vps-update.sh \| bash -s -- <old>` |
| **Uninstall** | `npm uninstall -g constellai` | `curl -fsSL …/scripts/vps-clean.sh \| bash` |
| **Wipe data** | `rm -rf ~/.constella` | vps-clean.sh removes `~/.constella` |
| **Diagnose** | console logs + [TROUBLESHOOTING](./TROUBLESHOOTING.md) | `journalctl -u constella` + checks below |

---

## Local (global install)

The CLI runs the web server **and** the worker in the foreground, supervised (auto-restarting a crashed child). The terminal you launch from *is* the process.

### Start / stop / restart

```bash
constella --start              # or --vps / --portable (a launch flag is required)
# stop: Ctrl-C in that terminal (graceful SIGINT — kills web + worker)
# restart: just run the command again
```

Run it **detached** so it survives the terminal closing:

```bash
# Linux/macOS — quick background + log file
nohup constella --start > ~/.constella/constella.log 2>&1 &
#   stop later:  pkill -f bin/constella.mjs
```

For a real always-on local service, prefer a supervisor:

- **Linux — systemd** (`~/.config/systemd/user/constella.service`):
  ```ini
  [Unit]
  Description=Constella
  [Service]
  ExecStart=%h/.nvm/versions/node/<ver>/bin/constella --start
  Restart=on-failure
  [Install]
  WantedBy=default.target
  ```
  `systemctl --user enable --now constella` · `systemctl --user status constella` · `journalctl --user -u constella -f`.
- **macOS** — a `launchd` `~/Library/LaunchAgents/*.plist`, or just `nohup`.
- **Windows** — run in a dedicated terminal, or wrap with [nssm](https://nssm.cc) as a service.

### Status / logs

```bash
constella update --check                 # installed version vs latest on npm
curl -I http://127.0.0.1:3000            # expect HTTP 302 → /login (auth is always required)
# logs: whatever the foreground process prints (or your nohup/systemd log)
```

A healthy boot prints: `• Secrets ready …`, `Mode : <mode> · 127.0.0.1:3000`, `Starting: next start …`, and the worker line `Constella worker → tick … every 60000ms`.

### Update / rollback / uninstall

```bash
npm install -g constellai@latest          # update (or: constella update)
constella --start                        # relaunch to load the new version

npm install -g constellai@0.1.0           # rollback to a specific version

npm uninstall -g constellai               # remove the CLI (data stays in ~/.constella)
rm -rf ~/.constella                      # ALSO wipe data — irreversible (DB, secrets, workspaces)
```

---

## VPS (native: npm + Tailscale + systemd)

A VPS is a **native install on the host** — no Docker, no containers, no compose, no image rebuilds. The managed install puts Node ≥20 + the `constellai` CLI on the host, joins **Tailscale** (the host itself is the tailnet node), and registers a `systemd` service `constella.service` that runs `constella --vps --host 0.0.0.0 --port 3000` (starts on boot, `Restart=always`). Data lives in `~/.constella` (DB, secrets, workspaces) and survives updates and reinstalls.

> Install: `curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/install.sh | bash -s -- --vps` (managed, recommended), equivalent to `bash scripts/vps-install.sh`. Quick/unmanaged try: `npx constellai --vps` (foreground, auto-joins Tailscale, no systemd). See [VPS_MODE](./VPS_MODE.md) for the full deployment.

### Start / stop / restart

```bash
systemctl start constella                # start the service
systemctl stop constella                 # stop it (data kept)
systemctl restart constella              # restart the app + worker
systemctl enable constella               # start on every boot (the installer enables it)
systemctl disable constella              # don't start on boot
```

### Verify it's running / status

```bash
systemctl status constella               # active (running)? last logs? enabled on boot?
tailscale ip -4                          # the tailnet IP to open
curl -I http://<tailnet-ip>:3000         # expect HTTP 302 → /login (login enforced in VPS)
```

### Logs (live)

```bash
journalctl -u constella -f               # app: web + worker  (Ctrl-C detaches)
journalctl -u constella --since "10 min ago"   # recent window
journalctl -u constella -n 200           # last 200 lines
```

### Check the port / bind

```bash
ss -tlnp | grep 3000 || netstat -tlnp | grep 3000
# the server binds 0.0.0.0:3000 on the host; Tailscale keeps it private to the tailnet
```

### Validate Tailscale

```bash
tailscale status                         # host's view of the tailnet (the host is the node)
tailscale ip -4                          # the IP you open in the browser
tailscale up                             # re-join if the host dropped off the tailnet
```

Tailscale won't connect → re-run `tailscale up` to re-authenticate the host. The clean script **keeps** Tailscale so SSH-over-tailnet survives a reinstall.

### Update safely

```bash
# Native install (no repo checkout needed) — pull the updater straight from GitHub:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash
# pin a specific version:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash -s -- 0.2.30

# From a repo checkout instead:
bash scripts/vps-update.sh                 # → latest on npm
bash scripts/vps-update.sh 0.2.30          # → a specific version

# Fully manual (no script at all):
sudo npm install -g constellai@latest && sudo systemctl restart constella
```

> **Updating while it's running is fine — no manual stop needed.** `npm install -g` swaps the package on disk without touching the live process; `systemctl restart constella` then cycles in the new version in a ~2–3s blip. Your `~/.constella` (DB, secrets, login, workspaces) is preserved, and the idempotent drizzle migrations run automatically on the next boot. Roll back any time by pinning the old version (e.g. `bash scripts/vps-update.sh 0.2.27`).

### Rollback

```bash
bash scripts/vps-update.sh 0.1.1         # install the previous version; data preserved
```

### Uninstall / clean

```bash
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash
# non-interactive:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash -s -- --yes
```

It removes the `constella.service` systemd unit, the `constellai` CLI, `~/.constella` (DB, secrets, workspaces) and the npx cache — but **keeps Tailscale** so you don't lose SSH-over-tailnet. Reinstall any time with `npx constellai --vps`.

---

## Diagnose 🔍

A quick triage path when something's off:

1. **Is the service up?** Local: `curl -I http://127.0.0.1:3000`. VPS: `systemctl status constella`.
2. **Read the logs.** Local: the foreground output. VPS: `journalctl -u constella -f` — boot errors (DB migrate, missing secret, port in use) print here.
3. **Network.** VPS unreachable → `tailscale status` (is the host on the tailnet?), then `tailscale ip -4` (right IP?).
4. **Port.** `3000` taken → relaunch with `--port`/`PORT` (local), or set `--port`/`PORT` in the service env and `systemctl restart constella` (VPS).
5. **Agents idle?** No `claude`/`codex` authed and no cloud provider → see [MODELS](./MODELS.md) and [AGENTS](./AGENTS.md).
6. **Crash-loop** (`✖ [web] … crashed 5x … giving up`) → OS-level OOM or a native crash; cap concurrent agents or raise `CONSTELLA_WEB_HEAP_MB`.

Full symptom/cause/fix tables: [TROUBLESHOOTING](./TROUBLESHOOTING.md).

---

## Common scenarios

| I want to… | Local | VPS |
| --- | --- | --- |
| Apply a new release | `npm i -g constellai@latest` → relaunch | `curl -fsSL …/scripts/vps-update.sh \| bash` |
| Undo a bad release | `npm i -g constellai@<old>` | `curl -fsSL …/scripts/vps-update.sh \| bash -s -- <old>` |
| See what's wrong on boot | watch the console | `journalctl -u constella -f` |
| Move the data elsewhere | `--path /new/dir` / `CONSTELLA_HOME` | set `CONSTELLA_HOME` in the service env |
| Back up before updating | copy `~/.constella` | copy `~/.constella` (the updater preserves it) |
| Fully remove everything | `npm uninstall -g constellai && rm -rf ~/.constella` | `curl -fsSL …/scripts/vps-clean.sh \| bash` |

---

## Related links

- [INSTALLATION](./INSTALLATION.md) — install per OS, configure each install target
- [UPDATE](./UPDATE.md) — context-aware updates & rollback
- [VPS_MODE](./VPS_MODE.md) — the native npm + Tailscale + systemd deployment in depth
- [CONFIGURATION](./CONFIGURATION.md) — env vars, ports, the vault
- [TROUBLESHOOTING](./TROUBLESHOOTING.md) · [FAQ](./FAQ.md)
- [SECURITY](./SECURITY.md) — secrets, the FS jail, worker isolation
</content>
</invoke>
