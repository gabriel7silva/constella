// Launches `next dev` (web) AND the background worker together for LOCAL DEVELOPMENT, so inbound
// Telegram messages, the cron tick and the filesystem sync watcher run in dev too. `next dev` on its
// own starts only the web server — without the worker the Telegram bot is never polled (you send a
// message and nothing happens). Mirrors scripts/start-all.mjs but for dev (next dev instead of next
// start, with a longer worker warm-up since next dev compiles on first request).
//
// Run it with `npm run dev:all`. Dependency-free: spawns both as child processes, forwards their
// output, and shuts both down together when either dies or on Ctrl-C.
import { spawn } from "node:child_process";

// Running from source = DEVELOPER mode (run-mode picker + Config chips), same as start-all.
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

console.log("Constella (dev) → next dev + worker (Telegram poll · cron tick · file watcher).");
// Web (dev) first — next dev loads .env on its own.
run("web", ["node_modules/next/dist/bin/next", "dev"]);
// Worker after a longer warm-up than start-all (next dev binds + compiles lazily). Plain Node needs
// --env-file to read .env; the worker self-retries until the dev server answers, so the delay is just
// to avoid a burst of "connection refused" logs on the very first ticks.
setTimeout(() => run("worker", ["--env-file=.env", "bin/worker.mjs"]), 4000);
