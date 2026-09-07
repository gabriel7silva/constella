"use server";

import os from "node:os";
import { randomUUID as uid } from "node:crypto";
import { createHash } from "node:crypto";
import { createWriteStream, createReadStream, mkdirSync, statSync, existsSync, readFileSync, writeFileSync, readdirSync, chmodSync, rmSync } from "node:fs";
import { spawn, execSync, execFileSync } from "node:child_process";
import AdmZip from "adm-zip";
import { join } from "node:path";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { provider, localModel } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { constellaHome } from "@/lib/fs-workspace";
import { indexRag } from "@/server/rag";
import { freeBytes, verifyDownloadedFileSize } from "@/server/portable";
import { DL_PROGRESS } from "@/server/download-progress";
import { GGUF_CATALOG } from "@/data/model-catalog";

const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

// In-flight download byte progress lives in a SHARED module (not this "use server" file) so the
// /api/models/progress route can read it concurrently — a server-action poll would serialize behind
// the download action and never update mid-download. The UI polls that API route.
const LLAMACPP = process.env.LLAMACPP_URL ?? "http://127.0.0.1:8082";
// Dedicated llama.cpp EMBEDDING server (separate port/instance from the chat server) — powers RAG.
const EMBED_URL = process.env.CONSTELLA_EMBED_URL ?? "http://127.0.0.1:8083";

export type Hardware = {
  cpu: string; cores: number; ram: string; gpu: string; vram: string; diskFree: string;
  backend: string; accel: string[]; recommendedQuant: string; maxParams: string;
};

// Hardware is static for the process lifetime; the nvidia-smi/df probes cost ~4s, which made
// every /models load slow. Cache the result (refresh only the cheap free-RAM figure on read).
let hwCache: Hardware | null = null;

/** Real hardware probe (no fakes) — os for CPU/cores/RAM, nvidia-smi/platform for GPU/backend.
 *  Cached after the first probe (the expensive part doesn't change). */
export async function detectHardware(): Promise<Hardware> {
  if (hwCache) {
    const totalGb = os.totalmem() / 1024 ** 3, freeGb = os.freemem() / 1024 ** 3;
    return { ...hwCache, ram: `${totalGb.toFixed(0)} GB · ${freeGb.toFixed(1)} free` };
  }
  const cpus = os.cpus();
  const cpu = (cpus[0]?.model ?? "Unknown CPU").replace(/\s+/g, " ").trim();
  const cores = cpus.length;
  const totalGb = os.totalmem() / 1024 ** 3;
  const freeGb = os.freemem() / 1024 ** 3;
  const ram = `${totalGb.toFixed(0)} GB · ${freeGb.toFixed(1)} free`;
  const platform = os.platform();
  let gpu = "—", vram = "—", backend = "CPU";
  const accel: string[] = [];
  try {
    const out = execSync("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits", {
      timeout: 4000, stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
    if (out) {
      const [name, mem] = out.split("\n")[0].split(",");
      gpu = name.trim(); vram = `${Math.round(Number(mem) / 1024)} GB`; backend = "CUDA"; accel.push("CUDA");
    }
  } catch { /* no NVIDIA GPU / nvidia-smi absent */ }
  // Apple Silicon (M-series): real chip name + UNIFIED memory as the GPU budget (RAM == VRAM).
  if (backend === "CPU" && platform === "darwin") {
    backend = "Metal"; accel.push("Metal");
    let chip = "Apple Silicon";
    try {
      const brand = execFileSync("sysctl", ["-n", "machdep.cpu.brand_string"], { timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (brand) chip = brand; // e.g. "Apple M3 Pro"
    } catch { if (/apple/i.test(cpu)) chip = cpu; }
    gpu = /apple/i.test(chip) ? `${chip} GPU` : "Apple GPU";
    if (os.arch() === "arm64") {
      // Metal's default per-process working-set budget is ~70% of unified memory — use that as VRAM
      // so the GPU fit-check is realistic (the GPU shares system RAM on Apple Silicon).
      vram = `${Math.max(1, Math.round(totalGb * 0.7))} GB unified`;
    }
  }
  accel.push(os.arch() === "arm64" ? "NEON" : "AVX2");
  let diskFree = "—";
  try {
    if (platform === "win32") {
      // No shell: pass args directly so the (validated) drive letter can't be a
      // command-injection vector. Drive is a single A–Z letter by construction.
      const d = (constellaHome()[0] || "C").toUpperCase();
      const drive = /^[A-Z]$/.test(d) ? d : "C";
      const out = execFileSync("powershell", ["-NoProfile", "-Command", `(Get-PSDrive ${drive}).Free`], { timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      const bytes = Number(out.replace(/[^\d]/g, ""));
      if (bytes > 0) diskFree = `${(bytes / 1024 ** 3).toFixed(0)} GB`;
    } else {
      // No shell: the home path is an arg to df, never interpolated into a command
      // string. Parse the last line (the mount row) in JS instead of piping to tail.
      const out = execFileSync("df", ["-h", constellaHome()], { timeout: 4000, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      const lines = out.split("\n");
      const parts = (lines[lines.length - 1] ?? "").split(/\s+/); if (parts[3]) diskFree = parts[3];
    }
  } catch { /* best-effort */ }
  const recommendedQuant = totalGb >= 32 ? "Q5_K_M" : totalGb >= 16 ? "Q4_K_M" : "Q4_0";
  const maxParams = totalGb >= 64 ? "70B" : totalGb >= 32 ? "34B" : totalGb >= 16 ? "13B" : "7B";
  hwCache = { cpu, cores, ram, gpu, vram, diskFree, backend, accel, recommendedQuant, maxParams };
  return hwCache;
}

/** Is the Ollama binary installed + on PATH? */
export async function ollamaInstalled(): Promise<boolean> {
  try { execSync("ollama --version", { timeout: 3000, stdio: "ignore" }); return true; }
  catch { return false; }
}

/** Start/stop the real Ollama daemon — reports the precise reason if it can't start. */
export async function ollamaServe(action: "start" | "stop"): Promise<{ up: boolean; installed: boolean; log: string[] }> {
  const installed = await ollamaInstalled();
  const log: string[] = [];
  if (action === "start") {
    if (!installed) return { up: false, installed: false, log: ["Ollama is not installed — get it at https://ollama.com, then retry."] };
    if ((await ollamaInfo()).up) return { up: true, installed, log: [`server already running on ${OLLAMA}`] };
    try {
      const child = spawn("ollama", ["serve"], { detached: true, stdio: "ignore" });
      let spawnErr = "";
      child.on("error", (e) => { spawnErr = String(e instanceof Error ? e.message : e); });
      child.unref();
      log.push("$ ollama serve");
      await new Promise((r) => setTimeout(r, 2000));
      const up = (await ollamaInfo()).up;
      if (spawnErr) log.push("spawn failed: " + spawnErr);
      log.push(up ? `✓ ready · ${OLLAMA}` : "still stopped — the port may be busy; run `ollama serve` in a terminal to see the error.");
      revalidatePath("/models");
      return { up, installed, log };
    } catch (e) {
      return { up: false, installed, log: ["failed to start: " + String(e instanceof Error ? e.message : e)] };
    }
  }
  try {
    if (os.platform() === "win32") execSync("taskkill /IM ollama.exe /F", { stdio: "ignore", timeout: 4000 });
    else execSync("pkill -f 'ollama serve'", { stdio: "ignore", timeout: 4000 });
    log.push("server stopped");
  } catch { log.push("no running ollama process found"); }
  revalidatePath("/models");
  return { up: false, installed, log };
}

/** Models currently loaded in Ollama memory (real /api/ps). */
export async function ollamaPs(): Promise<{ running: { name: string; vram: number }[] }> {
  try {
    const r = await fetch(`${OLLAMA}/api/ps`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { running: [] };
    const j = await r.json();
    return { running: (j.models ?? []).map((m: { name: string; size_vram?: number }) => ({ name: m.name, vram: m.size_vram ?? 0 })) };
  } catch { return { running: [] }; }
}

/** Load a model into Ollama memory (real — empty generate with keep_alive). */
export async function loadModel(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${OLLAMA}/api/generate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: name, prompt: "", keep_alive: "30m" }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) return { ok: false, error: `Ollama ${r.status}` };
    await r.json().catch(() => ({}));
    revalidatePath("/models");
    return { ok: true };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return { ok: false, error: /abort|fetch failed|ECONN/i.test(msg) ? "Ollama not running" : msg };
  }
}

/* ----------------------------------------------------------------- Ollama */
export async function ollamaInfo(): Promise<{ up: boolean; models: { name: string; size: number }[] }> {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { up: false, models: [] };
    const j = await r.json();
    return { up: true, models: (j.models ?? []).map((m: { name: string; size?: number }) => ({ name: m.name, size: m.size ?? 0 })) };
  } catch { return { up: false, models: [] }; }
}

/** Ensure an Ollama provider row exists for this workspace and reflects the live model count. */
async function refreshOllamaProvider(workspaceId: string) {
  const info = await ollamaInfo();
  const [row] = await db.select().from(provider).where(and(eq(provider.workspaceId, workspaceId), eq(provider.catalogId, "ollama")));
  const patch = { status: (info.up ? "connected" : "needs_sync") as "connected" | "needs_sync", modelCount: info.models.length, lastSync: info.up ? new Date() : null };
  if (row) await db.update(provider).set(patch).where(eq(provider.id, row.id));
  else await db.insert(provider).values({ id: uid(), workspaceId, catalogId: "ollama", adapter: "local_ollama", kind: "local", auth: "local", syncStatus: "implemented", ...patch });
}

/** Pull (download) an Ollama model via the daemon. Blocks until done; honest on failure. */
export async function pullModel(name: string): Promise<{ ok: boolean; error?: string }> {
  const { workspace } = await requireWorkspace();
  if (!name.trim()) return { ok: false, error: "no model name" };
  try {
    const r = await fetch(`${OLLAMA}/api/pull`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), stream: false }),
      signal: AbortSignal.timeout(1_800_000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `Ollama ${r.status}${t ? ": " + t.slice(0, 120) : ""}` };
    }
    const j = await r.json().catch(() => ({}));
    await refreshOllamaProvider(workspace.id);
    revalidatePath("/models");
    return { ok: j.status === "success" || j.error == null, error: j.error };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return { ok: false, error: /abort|fetch failed|ECONN/i.test(msg) ? "Ollama not running — start it, then retry." : msg };
  }
}

export async function removeModel(name: string): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  try {
    await fetch(`${OLLAMA}/api/delete`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  } catch { /* ignore */ }
  await refreshOllamaProvider(workspace.id);
  revalidatePath("/models");
  return { ok: true };
}

/* ----------------------------------------------------------------- llama.cpp GGUF */
function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

/** Download a GGUF for llama.cpp into the shared models dir, verify (if a hash is known), register it. */
export async function downloadGguf(id: string): Promise<{ ok: boolean; error?: string; path?: string }> {
  const { workspace } = await requireWorkspace();
  const m = GGUF_CATALOG.find((g) => g.id === id);
  if (!m) return { ok: false, error: "unknown model" };
  const dir = join(constellaHome(), "models");
  mkdirSync(dir, { recursive: true });
  // Pre-download space gate — refuse if the drive can't hold the model (esp. important for portable).
  const free = freeBytes(dir);
  if (free && m.sizeBytes && free < m.sizeBytes * 1.1) {
    return { ok: false, error: `not enough free space — need ~${(m.sizeBytes / 1e9).toFixed(1)} GB, ${(free / 1e9).toFixed(1)} GB free` };
  }
  const file = m.url.split("/").pop() ?? `${m.id}.gguf`;
  const dest = join(dir, file);
  DL_PROGRESS.set(id, { received: 0, total: 0, done: false });
  try {
    if (!existsSync(dest)) {
      const res = await fetch(m.url, { signal: AbortSignal.timeout(3_600_000) });
      if (!res.ok || !res.body) { DL_PROGRESS.set(id, { received: 0, total: 0, done: true, error: `download failed (${res.status})` }); return { ok: false, error: `download failed (${res.status})` }; }
      // Prefer the server's Content-Length; fall back to the catalog's known size so the UI %/bar shows
      // even when the CDN omits the header (some HuggingFace LFS redirects do).
      const expected = Number(res.headers.get("content-length")) || m.sizeBytes || 0;
      // Count bytes as they flow (src → counter → file) so the UI can show a live %/bar.
      let received = 0;
      DL_PROGRESS.set(id, { received: 0, total: expected, done: false });
      const counter = new PassThrough();
      counter.on("data", (c: Buffer) => { received += c.length; const p = DL_PROGRESS.get(id); if (p) p.received = received; });
      await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), counter, createWriteStream(dest));
      // Post-download integrity: a truncated/incomplete file must never be installed.
      const sz = verifyDownloadedFileSize(dest, expected);
      if (!sz.ok) { try { rmSync(dest); } catch { /* ignore */ } DL_PROGRESS.set(id, { received, total: expected, done: true, error: sz.message }); return { ok: false, error: sz.message }; }
    }
    DL_PROGRESS.set(id, { received: 1, total: 1, done: true });
    if (m.sha256) {
      const got = await sha256OfFile(dest);
      if (got !== m.sha256) return { ok: false, error: "SHA-256 mismatch — file corrupt" };
    }
    const size = statSync(dest).size;
    // Register the GGUF once for the whole MACHINE — dedup by file across ALL workspaces (the model is
    // shared from ~/.constella/models, so a different workspace must not re-register or re-download it).
    const [existing] = await db.select().from(localModel).where(eq(localModel.file, dest));
    if (!existing) {
      await db.insert(localModel).values({ id: uid(), workspaceId: workspace.id, name: m.name, file: dest, quant: m.quant, params: m.params, sizeBytes: size, sha256: m.sha256 ?? "", bind: "127.0.0.1:8082" });
    }
    // An embedding model just landed → bring the RAG embedding server up so retrieval is semantic.
    if (/embed|nomic|bge|mxbai|gte/i.test(m.name)) void ensureEmbedServer().catch(() => {});
    revalidatePath("/models");
    return { ok: true, path: dest };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    const p = DL_PROGRESS.get(id); DL_PROGRESS.set(id, { received: p?.received ?? 0, total: p?.total ?? 0, done: true, error: msg });
    return { ok: false, error: msg };
  }
}

/** Live byte progress for an in-flight GGUF download (polled by the UI). Null until the download starts. */
export async function downloadProgress(id: string): Promise<{ received: number; total: number; done: boolean; error?: string } | null> {
  return DL_PROGRESS.get(id) ?? null;
}

/** Uninstall a downloaded GGUF: delete the file on disk + its row. (removeModel only deletes from
 *  the Ollama registry — GGUF files had no uninstall path before.) */
export async function removeGguf(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireWorkspace();
  // Global by id — a GGUF is a machine resource. Delete the on-disk file + every workspace's row for it.
  const [row] = await db.select().from(localModel).where(eq(localModel.id, id));
  if (!row) return { ok: false, error: "model not found" };
  try { if (row.file && existsSync(row.file)) rmSync(row.file, { force: true }); } catch { /* already gone */ }
  await db.delete(localModel).where(eq(localModel.file, row.file));
  revalidatePath("/models");
  return { ok: true };
}

/** Directory we install our own llama.cpp prebuilt into. */
function llamaDir(): string { return join(constellaHome(), "bin", "llama"); }
/** The llama-server binary WE installed (marker → abs path), or null. NOT a server action (sync). */
function installedLlamaBinary(): string | null {
  try {
    const marker = join(llamaDir(), "INSTALLED");
    if (!existsSync(marker)) return null;
    const p = readFileSync(marker, "utf8").trim();
    return p && existsSync(p) ? p : null;
  } catch { return null; }
}
/** Recursively find a file by exact name (bounded depth) under a dir. */
function findFile(dir: string, name: string, depth: number): string | null {
  if (depth < 0) return null;
  let entries: import("node:fs").Dirent[];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) if (e.isFile() && e.name === name) return join(dir, e.name);
  for (const e of entries) if (e.isDirectory()) { const r = findFile(join(dir, e.name), name, depth - 1); if (r) return r; }
  return null;
}
/** Pick the best llama.cpp release asset for this OS/arch (+ CUDA when wanted). */
function pickLlamaAsset(assets: { name: string; browser_download_url: string }[], wantCuda: boolean): { name: string; url: string } | null {
  const p = os.platform();
  const osTag = p === "win32" ? /win/i : p === "darwin" ? /macos/i : /(ubuntu|linux)/i;
  const isArm = os.arch() === "arm64";
  // Windows ships .zip; macOS + Linux ship .tar.gz — accept both.
  let cands = assets.filter((a) => /\.(zip|tar\.gz|tgz)$/i.test(a.name) && osTag.test(a.name));
  if (!isArm) cands = cands.filter((a) => !/arm64|aarch64/i.test(a.name));
  const accel = /cuda|hip|vulkan|sycl|kompute|musa|cann|adreno/i;
  // Prefer the HOST architecture's asset — Apple Silicon (arm64) must NOT get the macos-x64 build.
  const pickArch = (list: typeof cands) => {
    if (!list.length) return null;
    const want = isArm ? list.filter((a) => /arm64|aarch64/i.test(a.name)) : list.filter((a) => /x64|amd64/i.test(a.name));
    const chosen = (want.length ? want : list).sort((a, b) => a.name.length - b.name.length)[0];
    return chosen ? { name: chosen.name, url: chosen.browser_download_url } : null;
  };
  if (wantCuda) { const cuda = cands.filter((a) => /cuda/i.test(a.name)); if (cuda.length) return pickArch(cuda); }
  const cpu = cands.filter((a) => !accel.test(a.name));
  return pickArch(cpu.length ? cpu : cands);
}

/** Download an archive (zip/tar.gz) and extract it into `dir`. Returns an error string or null.
 *  `progressKey` (e.g. "llama-server") streams byte progress into DL_PROGRESS so the UI shows a %/bar. */
async function downloadAndExtract(url: string, assetName: string, dir: string, progressKey?: string): Promise<string | null> {
  const isTar = /\.(tar\.gz|tgz)$/i.test(assetName);
  const archive = join(dir, assetName.replace(/[^\w.\-]+/g, "_"));
  mkdirSync(dir, { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(1_800_000) });
  if (!res.ok || !res.body) { if (progressKey) DL_PROGRESS.set(progressKey, { received: 0, total: 0, done: true, error: `download failed (${res.status})` }); return `download failed (${res.status})`; }
  const expected = Number(res.headers.get("content-length")) || 0;
  const src = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  if (progressKey) {
    let received = 0;
    DL_PROGRESS.set(progressKey, { received: 0, total: expected, done: false });
    const counter = new PassThrough();
    counter.on("data", (c: Buffer) => { received += c.length; const p = DL_PROGRESS.get(progressKey); if (p) p.received = received; });
    await pipeline(src, counter, createWriteStream(archive));
  } else {
    await pipeline(src, createWriteStream(archive));
  }
  const sz = verifyDownloadedFileSize(archive, expected);
  if (!sz.ok) { try { rmSync(archive); } catch { /* ignore */ } return sz.message; }
  if (isTar) execFileSync("tar", ["-xzf", archive, "-C", dir], { stdio: "ignore", timeout: 120_000 });
  else new AdmZip(archive).extractAllTo(dir, true);
  try { rmSync(archive); } catch { /* keep going */ }
  return null;
}

/** Latest llama.cpp release assets, or null when GitHub is unreachable/rate-limited. */
async function fetchLatestLlamaAssets(): Promise<{ name: string; browser_download_url: string }[] | null> {
  try {
    const r = await fetch("https://api.github.com/repos/ggml-org/llama.cpp/releases/latest", { headers: { "User-Agent": "constella", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    return ((await r.json()).assets ?? []) as { name: string; browser_download_url: string }[];
  } catch { return null; }
}

// One attempt per process run — a missing/failing cudart shouldn't re-trigger a 373 MB download each call.
let cudaRuntimeAttempted = false;
/**
 * Self-heal the CUDA runtime: a llama.cpp CUDA *build* (`ggml-cuda.dll`) needs the CUDA runtime DLLs
 * (`cudart64_*`, `cublas64_*`, `cublasLt64_*`) next to it — they ship in a SEPARATE
 * `cudart-…-cuda-<ver>-x64.zip`. Without them llama lists zero GPU devices and silently falls back to
 * CPU (so `-ngl` does nothing). This fetches the matching cudart (version read from ggml-cuda.dll's
 * imports) and drops the DLLs in. Idempotent: a no-op once the runtime is present or on a CPU build.
 * Windows-only (Linux/macOS CUDA/Metal builds bundle/link their runtime differently).
 */
async function ensureCudaRuntime(force = false): Promise<{ ok: boolean; fetched: boolean; reason?: string }> {
  if (os.platform() !== "win32") return { ok: true, fetched: false };
  const dir = llamaDir();
  let files: string[];
  try { files = readdirSync(dir); } catch { return { ok: false, fetched: false, reason: "no llama dir" }; }
  const hasCudaBuild = files.some((f) => /^ggml-cuda\.dll$/i.test(f));
  const hasRuntime = files.some((f) => /^cudart64_\d+\.dll$/i.test(f));
  if (!hasCudaBuild || hasRuntime) return { ok: hasRuntime || !hasCudaBuild, fetched: false };
  if (cudaRuntimeAttempted && !force) return { ok: false, fetched: false, reason: "already attempted this run" };
  cudaRuntimeAttempted = true;
  // Which cudart major does this ggml-cuda.dll import (cudart64_12 → "12", cudart64_13 → "13")?
  let major = "12";
  try { const m = readFileSync(join(dir, "ggml-cuda.dll")).toString("latin1").match(/cudart64_(\d+)\.dll/i); if (m) major = m[1]; } catch { /* default 12 */ }
  const assets = await fetchLatestLlamaAssets();
  if (!assets) return { ok: false, fetched: false, reason: "GitHub unreachable" };
  const cands = assets.filter((a) => /cudart/i.test(a.name) && /x64|amd64/i.test(a.name));
  const match = cands.find((a) => new RegExp(`cuda-${major}\\.`, "i").test(a.name)) ?? cands[0];
  if (!match) return { ok: false, fetched: false, reason: "no cudart asset in the latest release" };
  const err = await downloadAndExtract(match.browser_download_url, match.name, dir).catch((e) => String(e instanceof Error ? e.message : e));
  if (err) return { ok: false, fetched: false, reason: err };
  let ok = false; try { ok = readdirSync(dir).some((f) => /^cudart64_\d+\.dll$/i.test(f)); } catch { /* ignore */ }
  return { ok, fetched: ok };
}

/**
 * Auto-download + install the llama.cpp `llama-server` prebuilt (CPU by default, CUDA when an NVIDIA
 * GPU is detected) from the ggml-org/llama.cpp GitHub releases — extract into ~/.constella/bin/llama
 * and record the binary path. After this, Start server works with no manual setup. CUDA builds also
 * pull their CUDA runtime DLLs (ensureCudaRuntime) so the GPU works out of the box.
 */
export async function downloadLlamaServer(): Promise<{ ok: boolean; installed: boolean; path?: string; log: string[]; error?: string }> {
  await requireWorkspace();
  const log: string[] = [];
  if (installedLlamaBinary() || (await llamaServerInstalled())) {
    // Already installed — but re-running Install should REPAIR a missing CUDA runtime (the common
    // "GPU not used" cause). force=true so it retries even if a boot self-heal already failed.
    const cr = await ensureCudaRuntime(true).catch(() => null);
    return { ok: true, installed: true, log: ["llama-server already installed.", ...(cr?.fetched ? ["✓ fetched the CUDA runtime DLLs — GPU enabled."] : cr && !cr.ok ? [`⚠ CUDA runtime still missing (${cr.reason ?? "unknown"}).`] : [])] };
  }
  const hw = await detectHardware();
  const wantCuda = /cuda|nvidia/i.test(hw.backend) || (hw.accel ?? []).some((x) => /cuda|nvidia/i.test(x));
  log.push(`platform ${os.platform()}/${os.arch()} · backend ${hw.backend} → ${wantCuda ? "CUDA" : "CPU"} build`);

  let assets: { name: string; browser_download_url: string }[];
  try {
    const r = await fetch("https://api.github.com/repos/ggml-org/llama.cpp/releases/latest", { headers: { "User-Agent": "constella", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return { ok: false, installed: false, log, error: r.status === 403 ? "GitHub API rate-limited — try again later or install manually from the releases page." : `GitHub releases API ${r.status}` };
    assets = ((await r.json()).assets ?? []) as { name: string; browser_download_url: string }[];
  } catch (e) { return { ok: false, installed: false, log, error: "couldn't reach GitHub: " + String(e instanceof Error ? e.message : e) }; }

  const pick = pickLlamaAsset(assets, !!wantCuda);
  if (!pick) return { ok: false, installed: false, log, error: "no matching prebuilt for this platform — install manually from the releases page." };
  log.push(`downloading ${pick.name}…`);
  const dir = llamaDir();
  mkdirSync(dir, { recursive: true });
  DL_PROGRESS.set("llama-server", { received: 0, total: 0, done: false });
  try {
    const e1 = await downloadAndExtract(pick.url, pick.name, dir, "llama-server");
    if (e1) { DL_PROGRESS.set("llama-server", { received: 0, total: 0, done: true, error: e1 }); return { ok: false, installed: false, log, error: e1 }; }
    // CUDA prebuilts ship WITHOUT the CUDA runtime DLLs (cudart/cublas) — fetch + extract the matching
    // `cudart-…-cuda-<ver>-x64.zip` next to the binary so the GPU works out of the box.
    if (wantCuda) {
      const cr = await ensureCudaRuntime(true);
      log.push(cr.ok ? (cr.fetched ? "✓ CUDA runtime DLLs installed — GPU enabled." : "CUDA runtime already present.")
                     : `⚠ CUDA runtime not installed (${cr.reason ?? "unknown"}) — runs on CPU; retries on next Start/Install.`);
    }
  } catch (e) { return { ok: false, installed: false, log, error: "download/extract failed: " + String(e instanceof Error ? e.message : e) }; }

  const binName = os.platform() === "win32" ? "llama-server.exe" : "llama-server";
  const found = findFile(dir, binName, 5);
  if (!found) return { ok: false, installed: false, log, error: "downloaded, but llama-server wasn't found in the archive." };
  if (os.platform() !== "win32") { try { chmodSync(found, 0o755); } catch { /* best-effort */ } }
  writeFileSync(join(dir, "INSTALLED"), found, "utf8");
  DL_PROGRESS.set("llama-server", { received: 1, total: 1, done: true });
  log.push(`✓ installed → ${found}`);
  await connectLlamaCpp().catch(() => {});
  revalidatePath("/models");
  return { ok: true, installed: true, path: found, log };
}

/** Is the llama.cpp `llama-server` binary installed — our own install OR on PATH? */
export async function llamaServerInstalled(): Promise<boolean> {
  if (installedLlamaBinary()) return true;
  try { execSync("llama-server --version", { timeout: 3000, stdio: "ignore" }); return true; }
  catch { return false; }
}

/** Live llama.cpp server status (OpenAI-compatible /v1/models) + the model it's serving. */
export async function llamaServerStatus(): Promise<{ up: boolean; model: string | null }> {
  try {
    const r = await fetch(`${LLAMACPP}/v1/models`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return { up: false, model: null };
    const j = await r.json();
    const id: string | undefined = j.data?.[0]?.id;
    return { up: true, model: id ? (id.split(/[\\/]/).pop() ?? id) : null };
  } catch { return { up: false, model: null }; }
}

function parseGb(s: string): number { const m = /([\d.]+)\s*GB/i.exec(s || ""); return m ? parseFloat(m[1]) * 1e9 : 0; }

/** llama.cpp GPU-offload flag. Offloads layers to the GPU when a CUDA/Metal backend is present — and,
 *  for a sized model, only when it fits VRAM (else stay on CPU so a too-big model still loads). `-ngl 99`
 *  puts every layer on the GPU; on a CPU-only build/machine the flag is harmlessly ignored. Without this,
 *  llama.cpp defaults to ngl=0 = pure CPU even on a CUDA build — which pegged the CPU for RAG embeddings. */
async function gpuOffloadArgs(sizeBytes?: number): Promise<string[]> {
  try {
    const hw = await detectHardware();
    if (!/cuda|metal/i.test(hw.backend)) return [];
    const vram = parseGb(hw.vram);
    if (sizeBytes && vram && sizeBytes * 1.15 > vram) return []; // won't fit → CPU (don't fail the load)
    return ["-ngl", "99"];
  } catch { return []; }
}

/* ----------------------------------------------------------------- embeddings (RAG) */
/** An installed GGUF that is an embedding model (nomic / *embed*), file present on disk. Any
 *  workspace's row works — the GGUF lives in the shared ~/.constella/models dir. */
function installedEmbedModel(): { file: string; name: string } | null {
  try {
    const rows = db.select({ file: localModel.file, name: localModel.name }).from(localModel).all();
    const r = rows.find((x) => /embed|nomic|bge|mxbai|gte/i.test(x.name) && x.file && existsSync(x.file));
    return r ? { file: r.file, name: r.name } : null;
  } catch { return null; }
}

/** The first installed NON-embed GGUF on disk (a chat/reasoning/code model the main server can serve). */
function installedChatModel(): { file: string; name: string; sizeBytes: number } | null {
  try {
    const rows = db.select({ file: localModel.file, name: localModel.name, sizeBytes: localModel.sizeBytes }).from(localModel).all();
    const r = rows.find((x) => !/embed|nomic|bge|mxbai|gte/i.test(x.name) && x.file && existsSync(x.file));
    return r ? { file: r.file, name: r.name, sizeBytes: r.sizeBytes } : null;
  } catch { return null; }
}

/** Is the dedicated embedding server answering? */
export async function embedServerUp(): Promise<boolean> {
  try { const r = await fetch(`${EMBED_URL}/health`, { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch { return false; }
}

/**
 * Ensure the RAG embedding server is running: a SEPARATE llama.cpp instance serving the local
 * embedding GGUF (nomic) with `--embeddings` on :8083. Idempotent (no-op if already up). Returns
 * honest status — never fabricates. Used on boot + after an embed model downloads so every agent's
 * RAG retrieval is semantic with no manual setup.
 */
export async function ensureEmbedServer(): Promise<{ up: boolean; model?: string; reason?: string }> {
  if (await embedServerUp()) return { up: true };
  const bin = installedLlamaBinary();
  if (!bin) return { up: false, reason: "llama-server not installed" };
  const em = installedEmbedModel();
  if (!em) return { up: false, reason: "no embedding model installed (download nomic-embed-text)" };
  try {
    await ensureCudaRuntime().catch(() => {}); // self-heal a missing CUDA runtime so -ngl can offload
    const gargs = await gpuOffloadArgs(); // nomic is tiny → offload to GPU whenever one exists
    const child = spawn(bin, ["-m", em.file, "--embeddings", "--host", "127.0.0.1", "--port", "8083", "-c", "2048", "--pooling", "mean", ...gargs], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch (e) { return { up: false, reason: "spawn failed: " + String(e instanceof Error ? e.message : e) }; }
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await embedServerUp()) return { up: true, model: em.name };
  }
  return { up: false, reason: "embedding server didn't come up in time" };
}

/**
 * Ensure the MAIN llama.cpp server (:8082) is up, serving the first installed chat GGUF — the local
 * runtime an agent wired to `local_llamacpp` uses. Idempotent (no-op if already up or if no chat GGUF
 * is installed). GPU offload when the model fits VRAM. Called on boot so a downloaded local model is
 * ready without the manual "Start server" click.
 */
export async function ensureLlamaServer(): Promise<{ up: boolean; model?: string; reason?: string }> {
  if ((await llamaServerStatus()).up) return { up: true };
  const bin = installedLlamaBinary();
  if (!bin) return { up: false, reason: "llama-server not installed" };
  const cm = installedChatModel();
  if (!cm) return { up: false, reason: "no chat GGUF installed" };
  try {
    await ensureCudaRuntime().catch(() => {}); // self-heal CUDA runtime so -ngl offloads
    const gargs = await gpuOffloadArgs(cm.sizeBytes);
    const child = spawn(bin, ["-m", cm.file, "--host", "127.0.0.1", "--port", "8082", "-c", "4096", ...gargs], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch (e) { return { up: false, reason: "spawn failed: " + String(e instanceof Error ? e.message : e) }; }
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await llamaServerStatus()).up) return { up: true, model: cm.name };
  }
  return { up: false, reason: "llama server didn't come up in time" };
}

/** Embedding/RAG status for the Models UI. */
export async function embedStatus(): Promise<{ up: boolean; model: string | null; installed: boolean }> {
  const em = installedEmbedModel();
  return { up: await embedServerUp(), model: em?.name ?? null, installed: !!em };
}

/** Start the embedding server (UI button). */
export async function startEmbeddings(): Promise<{ up: boolean; model?: string; reason?: string }> {
  const r = await ensureEmbedServer();
  revalidatePath("/models");
  return r;
}

/** (Re)build the active org's RAG index — ensures the embed server first so chunks get real vectors. */
export async function reindexRag(): Promise<{ ok: boolean; chunks: number; embedded: boolean }> {
  const { org } = await requireWorkspace();
  await ensureEmbedServer().catch(() => {});
  const r = await indexRag(org.id);
  revalidatePath("/models");
  return r;
}

/** Register/refresh llama.cpp as a local provider — connected if the server answers; the model
 *  count reflects the registered local GGUF models. */
export async function connectLlamaCpp(): Promise<{ ok: boolean }> {
  const { workspace } = await requireWorkspace();
  const status = await llamaServerStatus();
  const locals = await db.select({ file: localModel.file }).from(localModel); // machine-wide GGUF registry
  const modelCount = new Set(locals.map((l) => l.file)).size; // dedup by file across workspaces
  const patch = { status: (status.up ? "connected" : "needs_sync") as "connected" | "needs_sync", modelCount, lastSync: status.up ? new Date() : null };
  const [row] = await db.select().from(provider).where(and(eq(provider.workspaceId, workspace.id), eq(provider.catalogId, "llamacpp")));
  if (row) await db.update(provider).set(patch).where(eq(provider.id, row.id));
  else await db.insert(provider).values({ id: uid(), workspaceId: workspace.id, catalogId: "llamacpp", adapter: "local_llamacpp", kind: "local", auth: "local", syncStatus: "implemented", ...patch });
  revalidatePath("/models");
  return { ok: true };
}

/** Start `llama-server` serving a GGUF on the loopback (OpenAI-compatible at :8082). Picks the
 *  given local model (or the first registered GGUF). Polls readiness; honest on failure. */
export async function startLlamaServer(modelId?: string): Promise<{ up: boolean; installed: boolean; log: string[] }> {
  await requireWorkspace();
  const installed = await llamaServerInstalled();
  const log: string[] = [];
  if (!installed) return { up: false, installed: false, log: ["llama-server not found — install llama.cpp from https://github.com/ggml-org/llama.cpp/releases (or `brew install llama.cpp`), then retry."] };
  if ((await llamaServerStatus()).up) return { up: true, installed, log: [`server already running on ${LLAMACPP}`] };
  const isEmbed = (name: string) => /embed|nomic|bge|mxbai|gte/i.test(name);
  let file: string | undefined; let sizeBytes = 0;
  if (modelId) {
    const [m] = await db.select().from(localModel).where(eq(localModel.id, modelId));
    // An EMBEDDING model can't serve chat completions — it belongs on the dedicated RAG server (:8083),
    // not the chat server (:8082). Route it there instead of loading it into the chat port.
    if (m && isEmbed(m.name)) {
      const er = await ensureEmbedServer();
      return { up: er.up, installed, log: [`${m.name} is an EMBEDDING model — started the RAG embedding server on :8083 (it can't power chat on :8082).`, er.up ? `✓ embeddings ready · ${EMBED_URL}` : `embeddings: ${er.reason ?? "failed to start"}`] };
    }
    file = m?.file; sizeBytes = m?.sizeBytes ?? 0;
  }
  // No explicit pick → serve the first CHAT (non-embed) model, NOT just the first row (which could be
  // an embedding model — loading that into the chat server was why an agent's run never worked).
  if (!file) { const cm = installedChatModel(); file = cm?.file; sizeBytes = cm?.sizeBytes ?? 0; }
  if (!file || !existsSync(file)) {
    // Only an embedding model is installed → route it to RAG (:8083) and tell the operator to grab a chat GGUF.
    const em = installedEmbedModel();
    if (em) {
      const er = await ensureEmbedServer();
      return { up: false, installed, log: [`Your only local model (${em.name}) is an EMBEDDING model — it powers RAG on the embeddings server (${EMBED_URL}), not the chat server.`, er.up ? "✓ embeddings server is running." : `embeddings: ${er.reason ?? "not started"}`, "Download a chat/instruct GGUF (e.g. Qwen, Llama) below to run the chat server on :8082."] };
    }
    return { up: false, installed, log: ["no GGUF model on disk — download one below first."] };
  }
  try {
    const bin = installedLlamaBinary() ?? "llama-server";
    await ensureCudaRuntime().catch(() => {}); // self-heal a missing CUDA runtime so -ngl can offload
    const gargs = await gpuOffloadArgs(sizeBytes); // GPU offload when the model fits VRAM, else CPU
    const child = spawn(bin, ["-m", file, "--host", "127.0.0.1", "--port", "8082", "-c", "4096", ...gargs], { detached: true, stdio: "ignore" });
    let spawnErr = "";
    child.on("error", (e) => { spawnErr = String(e instanceof Error ? e.message : e); });
    child.unref();
    log.push(`$ llama-server -m ${file.split(/[\\/]/).pop()} --port 8082${gargs.length ? " -ngl 99 (GPU)" : " (CPU)"}`);
    let up = false;
    for (let i = 0; i < 12 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); up = (await llamaServerStatus()).up; }
    if (spawnErr) log.push("spawn failed: " + spawnErr);
    log.push(up ? `✓ ready · ${LLAMACPP}` : "still starting — large models take longer; run llama-server in a terminal to see progress.");
    await connectLlamaCpp();
    revalidatePath("/models");
    return { up, installed, log };
  } catch (e) {
    return { up: false, installed, log: ["failed to start: " + String(e instanceof Error ? e.message : e)] };
  }
}

/** Stop the running llama.cpp server. */
export async function stopLlamaServer(): Promise<{ up: boolean; installed: boolean; log: string[] }> {
  const installed = await llamaServerInstalled();
  const log: string[] = [];
  try {
    // Kill ONLY the chat server (:8082). The RAG embedding server (:8083) is the SAME `llama-server` binary,
    // so a blanket `taskkill /IM` / `pkill -f llama-server` would also tear down embeddings and break every
    // agent's semantic retrieval. Scope by the chat port: its listening PID on Windows, its `--port 8082`
    // cmdline on POSIX.
    if (os.platform() === "win32") {
      const out = execSync('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"', { timeout: 5000 }).toString();
      const pids = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!pids.length) throw new Error("not running");
      for (const pid of pids) execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore", timeout: 4000 });
    } else {
      execSync("pkill -f -- 'llama-server.*--port 8082'", { stdio: "ignore", timeout: 4000 });
    }
    log.push("server stopped");
  } catch { log.push("no running chat llama-server process found"); }
  await connectLlamaCpp();
  revalidatePath("/models");
  return { up: false, installed, log };
}
