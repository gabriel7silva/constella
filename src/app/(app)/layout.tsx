import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { agent, inboxItem, notification, plan, user } from "@/db/schema";
import { requireWorkspace, listOrgs } from "@/lib/workspace";
import { Sidebar } from "@/components/shell/sidebar";
import { ChatDockGate } from "@/components/shell/chat-dock-gate";
import { RunnerHeartbeat } from "@/components/shell/runner-heartbeat";
import { SearchHotkey } from "@/components/shell/search-hotkey";
import { Toaster } from "@/components/shell/toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, org, workspace } = await requireWorkspace();
  const [agents, orgs, inbox, notifs, planRow, urow] = await Promise.all([
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    listOrgs(session.user.id),
    db.select().from(inboxItem).where(and(eq(inboxItem.workspaceId, workspace.id), eq(inboxItem.resolved, false))),
    db.select().from(notification).where(and(eq(notification.workspaceId, workspace.id), eq(notification.read, false))),
    db.select().from(plan).where(eq(plan.workspaceId, workspace.id)),
    // better-auth's session.user doesn't surface our custom `image` column — read it from the row.
    db.select({ image: user.image }).from(user).where(eq(user.id, session.user.id)),
  ]);
  const pl = planRow[0];
  const userImage = urow[0]?.image ?? null;

  return (
    <div className="app">
      <Sidebar
        orgs={orgs}
        currentOrgId={org.id}
        workspaceSlug={workspace.slug}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={userImage}
        inboxCount={inbox.length}
        notifCount={notifs.length}
      />
      <main className="app-main">{children}</main>
      <ChatDockGate
        agents={agents.map((a) => ({ id: a.id, handle: a.handle, name: a.name, role: a.role, color: a.color, image: a.image, adapter: a.adapter, status: a.status, health: a.health }))}
        operator={{ name: session.user.name, image: userImage }}
      />
      <RunnerHeartbeat approved={!!pl?.approved} auto247={!!pl?.auto247} />
      <SearchHotkey />
      <Toaster />
    </div>
  );
}
