import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { randomUUID as uid } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { vault } from "@/db/schema";

/**
 * Secret vault — API keys / GitHub PATs are AES-256-GCM encrypted at rest.
 * The key comes from CONSTELLA_VAULT_KEY (32-byte base64). Secrets NEVER touch
 * provider rows or reach the client.
 */
function key(): Buffer {
  const b64 = process.env.CONSTELLA_VAULT_KEY;
  if (!b64) throw new Error("CONSTELLA_VAULT_KEY is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CONSTELLA_VAULT_KEY must decode to 32 bytes");
  return k;
}

export async function putSecret(workspaceId: string, ref: string, plaintext: string, providerId?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([enc, tag]).toString("base64");
  // Single-valued per (workspace, ref): replace, never append — otherwise getSecret's first-row
  // read is non-deterministic and a re-registered token/allowlist (e.g. telegram chat id) can keep
  // serving the STALE row.
  await db.delete(vault).where(and(eq(vault.workspaceId, workspaceId), eq(vault.ref, ref)));
  await db.insert(vault).values({ id: uid(), workspaceId, providerId, ref, ciphertext, iv: iv.toString("base64") });
}

export async function getSecret(workspaceId: string, ref: string): Promise<string | null> {
  const [row] = await db.select().from(vault).where(and(eq(vault.workspaceId, workspaceId), eq(vault.ref, ref)));
  if (!row) return null;
  const raw = Buffer.from(row.ciphertext, "base64");
  const tag = raw.subarray(raw.length - 16);
  const enc = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Delete a stored secret (used by revoke-token). */
export async function delSecret(workspaceId: string, ref: string) {
  await db.delete(vault).where(and(eq(vault.workspaceId, workspaceId), eq(vault.ref, ref)));
}

/** Masked preview for the UI — never returns the plaintext. */
export function maskSecret(s: string) {
  if (s.length <= 8) return "••••";
  return s.slice(0, 3) + "••••••" + s.slice(-4);
}
