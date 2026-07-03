import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { personalAccessToken, organization, workspace } from "@/db/schema";
import { getActiveOrg, getWorkspace } from "@/lib/workspace";

/**
 * Personal Access Token authenticator for the public API (src/app/api/v1). The PAT UI in
 * profile-actions.ts already mints `cn_…` tokens stored as a sha256 hash; this is the consumer:
 * read `Authorization: Bearer cn_…`, sha256 it, match `personalAccessToken.tokenHash`, resolve the
 * token-owner's org/workspace (membership-secure via getActiveOrg, so the token can't be pointed at
 * a foreign tenant), and bump lastUsedAt. The token is NEVER logged. This is the ONLY credential on
 * the v1 routes — there is no session.
 */

type Org = typeof organization.$inferSelect;
type Workspace = typeof workspace.$inferSelect;
export type ApiAuth = { userId: string; tokenId: string; scope: string; org: Org; workspace: Workspace };
export type ApiAuthResult = { ok: true; auth: ApiAuth } | { ok: false; status: number; error: string };

/** Authenticate a request by its bearer PAT. `orgHeader` (X-Constella-Org) optionally selects which
 *  of the user's orgs to act on (defaults to their first); it is validated through a membership join. */
export async function authenticatePAT(authHeader: string | null, orgHeader?: string | null): Promise<ApiAuthResult> {
  const m = /^Bearer\s+(cn_[A-Za-z0-9_-]{8,})$/.exec((authHeader ?? "").trim());
  if (!m) return { ok: false, status: 401, error: "missing or malformed bearer token" };
  const hash = createHash("sha256").update(m[1]).digest("hex");
  const [tok] = await db.select().from(personalAccessToken).where(eq(personalAccessToken.tokenHash, hash));
  if (!tok) return { ok: false, status: 401, error: "invalid token" };

  // Best-effort usage stamp — never block or fail auth on a write hiccup.
  try { await db.update(personalAccessToken).set({ lastUsedAt: new Date() }).where(eq(personalAccessToken.id, tok.id)); } catch { /* ignore */ }

  const org = await getActiveOrg(tok.userId, orgHeader ?? undefined);
  if (!org) return { ok: false, status: 404, error: "no organization for this token's user" };
  if (org.archived) return { ok: false, status: 409, error: "organization is archived" };
  const ws = await getWorkspace(org.id);
  if (!ws) return { ok: false, status: 404, error: "no workspace for the organization" };

  return { ok: true, auth: { userId: tok.userId, tokenId: tok.id, scope: tok.scope, org, workspace: ws } };
}
