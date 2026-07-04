"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import {
  OPERATOR_DEFAULT,
  getOperator,
  operatorPasswordSet,
  operatorCredentialExists,
  upsertOperatorCredential,
  markOperatorPasswordSet,
} from "@/server/operator-credential";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * First-run signup for the single operator. Creates the operator account (or, for a legacy `--start` install,
 * claims the existing operator) and sets its password — never a second account, never the better-auth
 * public `signUp` path. After this returns `{ ok }`, the client signs in normally.
 *
 * SECURITY — takeover guard: allowed ONLY while the operator has no password credential yet. The DB is the
 * source of truth (`operatorCredentialExists()`); the `.env` flag (`operatorPasswordSet()`) is just a fast
 * hint. Gating on the flag ALONE was exploitable — a restored/copied `constella.db` (or a regenerated `.env`)
 * leaves a real credential in the DB while the flag is absent, which would let an unauthenticated request
 * reset the operator's password. Refuse whenever EITHER says a password exists. This is trust-on-first-use;
 * on the hardened VPS path the instance is only reachable on the operator's tailnet, so first-run is the operator.
 */
export async function signupAction(input: { email?: string; name?: string; password: string }): Promise<
  { ok: true; email: string } | { ok: false; error: "alreadyConfigured" | "invalid" }
> {
  if (operatorPasswordSet() || (await operatorCredentialExists())) return { ok: false, error: "alreadyConfigured" };

  const password = (input.password ?? "").trim();
  if (password.length < 8) return { ok: false, error: "invalid" };
  const email = (input.email ?? "").trim() || OPERATOR_DEFAULT.email;
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid" };
  const name = (input.name ?? "").trim() || OPERATOR_DEFAULT.name;

  const operator = await getOperator();
  const userId = operator?.id ?? OPERATOR_DEFAULT.id;
  if (!operator) {
    await db.insert(user).values({ id: userId, name, email, emailVerified: true }).onConflictDoNothing();
  } else if (operator.email !== email || operator.name !== name) {
    await db.update(user).set({ email, name, updatedAt: new Date() }).where(eq(user.id, userId));
  }

  await upsertOperatorCredential(userId, password);
  markOperatorPasswordSet();
  return { ok: true, email };
}
