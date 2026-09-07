import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { organization, workspace, member } from "@/db/schema";
import { auth } from "./auth";

/** Resolve the signed-in user (or null). */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** The active organization for the session, or the user's first org.
 *  SECURITY: `activeOrgId` is attacker-controllable (it's a plain column on the
 *  session row that `setActiveOrg` writes). It MUST be resolved through a
 *  membership join so a user can never point their session at another tenant's
 *  org — otherwise requireWorkspace() leaks a foreign workspace (cross-tenant IDOR). */
export async function getActiveOrg(userId: string, activeOrgId?: string | null) {
  if (activeOrgId) {
    const [row] = await db
      .select({ org: organization })
      .from(member)
      .innerJoin(organization, eq(member.orgId, organization.id))
      .where(and(eq(member.userId, userId), eq(organization.id, activeOrgId)));
    if (row) return row.org;
    // activeOrgId points at an org the user doesn't belong to → ignore it and fall through.
  }
  const rows = await db
    .select({ org: organization })
    .from(member)
    .innerJoin(organization, eq(member.orgId, organization.id))
    .where(eq(member.userId, userId));
  return rows[0]?.org ?? null;
}

/** The workspace for an org (one workspace per org in v1; extend later). */
export async function getWorkspace(orgId: string) {
  const [ws] = await db.select().from(workspace).where(eq(workspace.orgId, orgId));
  return ws ?? null;
}

/** Every organization the user belongs to (for the sidebar org switcher). */
export async function listOrgs(userId: string) {
  return db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(member.orgId, organization.id))
    .where(eq(member.userId, userId));
}

/**
 * Guard used by every (app) page/server-action: returns the scoped workspace
 * or redirects to login / onboarding. All queries MUST filter by workspaceId
 * to keep organizations isolated.
 */
export async function requireWorkspace() {
  const session = await getSession();
  // Auth is always required — send an unauthenticated request to the login/signup screen.
  if (!session) redirect("/login");
  // `constella --onboarding` forces the setup wizard (one-shot — completeOnboarding clears the flag,
  // so this doesn't loop after a new org is created).
  if (process.env.CONSTELLA_FORCE_ONBOARDING === "1") redirect("/onboarding");
  const org = await getActiveOrg(session.user.id, session.session.activeOrgId);
  if (!org) redirect("/onboarding");
  const ws = await getWorkspace(org.id);
  if (!ws) redirect("/onboarding");
  return { session, org, workspace: ws };
}

export function slugify(s: string) {
  return (s || "org").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
