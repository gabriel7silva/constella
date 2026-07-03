import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, normalize, sep, extname, basename } from "node:path";
import { requireWorkspace } from "@/lib/workspace";
import { orgRoot } from "@/lib/fs-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB/file
const MAX_FILES = 10;
const MAX_TOTAL = 80 * 1024 * 1024; // hard cap on the whole request body

// Gate on the EXTENSION (we also serve by extension), so the client-declared MIME can't matter.
// Active/renderable types (.svg/.html/.js/.css/.wasm/executables) are NOT allowed.
const SAFE_EXT = /\.(png|jpe?g|gif|webp|bmp|pdf|txt|md|markdown|csv|json|log|zip|docx?|xlsx?|pptx?)$/i;
// Types safe to render inline (thumbnails / pdf preview). Everything else → download.
const INLINE_CT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".pdf": "application/pdf" };

function safeUploadPath(root: string, rel: string): string | null {
  if (!rel.startsWith("uploads/") || rel.includes("..") || rel.includes("\0")) return null;
  const abs = normalize(join(root, rel));
  return abs.startsWith(root + sep) ? abs : null;
}

/** Upload ≤10 attachments (≤15 MB each) into the workspace `uploads/<id>/`. */
export async function POST(req: NextRequest) {
  const { org } = await requireWorkspace();
  const root = orgRoot(org.id);
  // Reject oversized bodies BEFORE buffering the whole multipart in memory.
  const cl = Number(req.headers.get("content-length") ?? 0);
  if (cl && cl > MAX_TOTAL) return NextResponse.json({ ok: false, error: "request too large" }, { status: 413 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (!files.length) return NextResponse.json({ ok: false, error: "no files" }, { status: 400 });

  const uploadId = randomUUID().slice(0, 8);
  const dir = join(root, "uploads", uploadId);
  mkdirSync(dir, { recursive: true });
  const out: { name: string; type: string; size: number; path: string }[] = [];
  let total = 0;
  for (const f of files) {
    if (f.size > MAX_BYTES) return NextResponse.json({ ok: false, error: `${f.name} exceeds 15 MB` }, { status: 400 });
    total += f.size;
    if (total > MAX_TOTAL) return NextResponse.json({ ok: false, error: "request too large" }, { status: 413 });
    const safeName = (basename(f.name).replace(/[^\w.\-]+/g, "_").slice(-80)) || "file";
    if (!SAFE_EXT.test(safeName)) return NextResponse.json({ ok: false, error: `${f.name}: file type not allowed` }, { status: 400 });
    const rel = `uploads/${uploadId}/${safeName}`;
    try { writeFileSync(join(root, rel), Buffer.from(await f.arrayBuffer())); }
    catch { return NextResponse.json({ ok: false, error: `couldn't save ${f.name}` }, { status: 500 }); }
    out.push({ name: f.name.slice(0, 120), type: f.type || "application/octet-stream", size: f.size, path: rel });
  }
  return NextResponse.json({ ok: true, attachments: out });
}

/** Serve an uploaded file (workspace-scoped, sanitised). nosniff + non-images download — never
 *  serve an active/renderable type from the app origin (stored-XSS hardening). */
export async function GET(req: NextRequest) {
  const { org } = await requireWorkspace();
  const root = orgRoot(org.id);
  const abs = safeUploadPath(root, req.nextUrl.searchParams.get("path") ?? "");
  if (!abs || !existsSync(abs)) return new NextResponse("not found", { status: 404 });
  const ext = extname(abs).toLowerCase();
  const inline = INLINE_CT[ext];
  const buf = readFileSync(abs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": inline ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${basename(abs).replace(/[^\w.\-]+/g, "_")}"`,
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "private, max-age=3600",
    },
  });
}
