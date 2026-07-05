import Link from "next/link";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { toggleTheme } from "@/server/session";
import { ConstellaMark } from "@/components/ui/constella-mark";
import { Icon } from "@/components/ui/icon";
import { ChatToggle } from "./chat-toggle";
import { AnimToggle } from "./anim-toggle";
import { LangSwitch } from "./lang-switch";
import { BackButton } from "./back-button";
import { SidebarToggle } from "./sidebar-toggle";
import { UpdateHeaderBadge } from "./update-header-badge";
import { MODULES } from "@/lib/modules";
import { t, normalizeLang } from "@/lib/i18n";

export async function Topbar({ title }: { title: string }) {
  const ck = await cookies();
  const theme = ck.get("cn-theme")?.value === "dark" ? "dark" : "light"; // light is the default
  const lang = normalizeLang(ck.get("cn-lang")?.value);
  const { workspace } = await requireWorkspace();
  const unread = (await db.select().from(notification).where(and(eq(notification.workspaceId, workspace.id), eq(notification.read, false)))).length;
  const mod = MODULES.find((m) => m.title === title);

  return (
    <div className="app-top">
      <SidebarToggle />
      <BackButton />
      <div className="app-crumb">
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", color: "inherit" }}>
          <ConstellaMark size={16} rx={5} /> Constella
        </Link>
        <Icon name="chevronRight" size={12} style={{ opacity: 0.4 }} />
        <b style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name={mod ? mod.icon : "grid"} size={14} style={{ color: "var(--accent)" }} /> {mod ? t(lang, `mod.${mod.id}`) : title}
        </b>
      </div>
      <div className="app-top-actions">
        <UpdateHeaderBadge />
        <Link href="/search" className="top-btn" title={t(lang, "nav.search")}><Icon name="search" size={17} /></Link>
        <Link href="/notifications" className="top-btn" title={t(lang, "top.notifications")} style={{ position: "relative" }}>
          <Icon name="bell" size={17} />{unread > 0 && <span className="nv-badge">{unread}</span>}
        </Link>
        <ChatToggle />
        <LangSwitch />
        <AnimToggle />
        <form action={toggleTheme.bind(null, theme)}>
          <button className="top-btn" title={t(lang, "top.theme")} type="submit"><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
        </form>
      </div>
    </div>
  );
}
