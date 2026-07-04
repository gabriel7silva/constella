import "server-only";
import { randomUUID as uid } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user, account } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * Shared operator-credential layer. Constella is single-operator and auth is ALWAYS required: the first run
 * with no chosen password shows a SIGNUP screen (create the operator + password), and every run afterwards
 * shows LOGIN. The operator is resolved the same way everywhere (the first `user` row), so it is never
 * duplicated.
 *
 * `CONSTELLA_OPERATOR_PW_SET` (a non-sensitive flag in the runtime root's `.env`) records that the operator
 * has chosen their own password. It gates the screen (signup vs login) and the signup takeover guard, and it
 * lets a legacy `--start` install (whose operator carried a system-generated credential) reclaim the account
 * via signup on first launch of this version.
 */

/** The default operator identity, used only when bootstrapping a brand-new operator. The fixed id matches
 *  the seed owner so a seeded demo org belongs to the operator. */
export const OPERATOR_DEFAULT = { id: "user_operator", email: "operator@constella.dev", name: "Operator" } as const;

const PW_SET_KEY = "CONSTELLA_OPERATOR_PW_SET";

/** The runtime root's secrets file — the SAME 0600 file the launcher writes (bin/constella.mjs). */
function envFilePath(): string {
  const home = process.env.CONSTELLA_HOME || join(homedir(), ".constella");
  return join(home, ".env");
}

function readEnvFile(): Record<string, string> {
  const p = envFilePath();
  if (!existsSync(p)) return {};
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch { return {}; }
}

/** Has the operator chosen their own password yet? Gates the screen (signup vs login) + the takeover guard. */
export function operatorPasswordSet(): boolean {
  return readEnvFile()[PW_SET_KEY] === "1";
}

/** Mark the operator's password as chosen — preserves every other secret already in the file. */
export function markOperatorPasswordSet(): void {
  const p = envFilePath();
  const vars = readEnvFile();
  vars[PW_SET_KEY] = "1";
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  try { chmodSync(p, 0o600); } catch { /* best-effort on Windows */ }
}

/** The single operator = the first user row (resolved the same way everywhere → never duplicated). */
export async function getOperator() {
  const [row] = await db.select().from(user).orderBy(asc(user.createdAt)).limit(1);
  return row ?? null;
}

/** Does the operator already have a password credential in the DB? The DB is the SOURCE OF TRUTH for "a
 *  password exists"; the `.env` flag is only a fast hint that can de-sync (a restored/copied `constella.db`
 *  into a fresh home, or a regenerated `.env`). The signup takeover guard must refuse whenever a real
 *  credential exists — otherwise, after such a de-sync, an unauthenticated caller could reset the
 *  operator's password and take over the account. */
export async function operatorCredentialExists(): Promise<boolean> {
  const operator = await getOperator();
  if (!operator) return false;
  const [cred] = await db.select({ id: account.id }).from(account)
    .where(and(eq(account.userId, operator.id), eq(account.providerId, "credential"))).limit(1);
  return !!cred;
}

/** Idempotently set the operator's password credential (better-auth `account`, providerId="credential",
 *  with a real password hash). Creates or updates the row — never a second user. */
export async function upsertOperatorCredential(userId: string, plaintext: string): Promise<void> {
  const ctx = await auth.$context;
  const password = await ctx.password.hash(plaintext);
  const [cred] = await db.select().from(account).where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (cred) {
    await db.update(account).set({ password, updatedAt: new Date() }).where(eq(account.id, cred.id));
  } else {
    await db.insert(account).values({ id: uid(), userId, accountId: userId, providerId: "credential", password });
  }
}
