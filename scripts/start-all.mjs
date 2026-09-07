// Launches the web server (next start) AND the background worker together, so a single
// `pnpm start` runs everything. The worker hosts the Telegram bot poll, cron tick, and the
// filesystem sync watcher — without it, inbound Telegram messages are never fetched. Keeping
// them in one command means the operator can't forget to start the worker separately.
//
// Dependency-free (no `concurrently`): spawns both as child processes, forwards their output,
// and shuts both down together when either dies or on Ctrl-C.
import { spawn } from "node:child_process";

// Running from source via `pnpm start` is DEVELOPER mode — show the run-mode picker + Config chips.
// (The published `constella` CLI sets CONSTELLA_PUBLIC=1 instead, which hides them.)
if (!process.env.CONSTELLA_PUBLIC) process.env.CONSTELLA_DEV = "1";

const procs = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { p } of procs) { try { p.kill(); } catch { /* already gone */ } }
  process.exit(code);
}

function run(name, args, extraEnv) {
  const p = spawn(process.execPath, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...extraEnv },
  });
  p.on("exit", (code) => {
    console.log(`[${name}] exited (${code}) — shutting down the other process too.`);
    shutdown(code ?? 1);
  });
  p.on("error", (e) => { console.error(`[${name}] failed to start:`, e.message); shutdown(1); });
  procs.push({ name, p });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Constella → starting web server + worker (single command).");
// Web server first. `next start` loads .env on its own.
run("web", ["node_modules/next/dist/bin/next", "start"]);
// Worker shortly after so the server is usually up first (the worker also self-retries if not).
// Plain Node needs --env-file to read .env (next does it internally).
setTimeout(() => run("worker", ["--env-file=.env", "bin/worker.mjs"]), 1500);
