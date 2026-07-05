"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, MODULE_GROUPS } from "@/lib/modules";
import { Icon } from "@/components/ui/icon";
import { OrgSwitcher } from "./org-switcher";
import { signOutAction } from "@/server/session";
import { useT } from "@/lib/i18n-context";

export function Sidebar({ orgs, currentOrgId, workspaceSlug, userName, userEmail, userImage, inboxCount, notifCount }: {
  orgs: { id: string; name: string }[];
  userImage?: string | null;
  currentOrgId: string;
  workspaceSlug: string;
  userName: string;
  userEmail: string;
  inboxCount: number;
  notifCount: number;
}) {
  const path = usePathname();
  const t = useT();
  return (
    <aside className="side">
      <div className="side-brand-wrap">
        <OrgSwitcher orgs={orgs} currentId={currentOrgId} workspaceSlug={workspaceSlug} />
      </div>

      <Link href="/search" className="nav-search">
        <Icon name="search" size={13} />
        <input placeholder={t("nav.search")} readOnly style={{ pointerEvents: "none" }} />
      </Link>

      <div className="side-nav scroll">
        {MODULE_GROUPS.map((g) => {
          const items = MODULES.filter((m) => m.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="nav-group-label">{t(`group.${g}`)}</div>
              {items.map((m) => {
                // Match by the first path segment so /organizations never matches /org.
                const seg = (h: string) => "/" + (h.split("/")[1] ?? "");
                const active = m.id === "home" ? path === "/" : seg(path) === seg(m.href);
                const badge = m.id === "inbox" ? inboxCount : m.id === "notifications" ? notifCount : 0;
                return (
                  <Link key={m.id} href={m.href} className={"nav-item" + (active ? " active" : "")}>
                    <Icon name={m.icon} size={17} /><span>{t(`mod.${m.id}`)}</span>
                    {badge ? <span className="nv-badge">{badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="side-foot">
        <div className="top-avatar" style={{ margin: 0, overflow: "hidden", padding: userImage ? 0 : undefined }}>
          {userImage
            // eslint-disable-next-line @next/next/no-img-element
            // Avatars are DB-stored data URLs (legacy values may be an uploads/ path served via /api/upload).
            ? <img src={/^(data:|https?:|\/)/.test(userImage) ? userImage : `/api/upload?path=${encodeURIComponent(userImage)}`} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : (userName?.[0] || "O").toUpperCase()}
        </div>
        <Link href="/profile" className="pf">
          <div className="pn">{userName || t("nav.operator")}</div>
          <div className="pe">{userEmail || ""}</div>
        </Link>
        <form action={signOutAction}>
          <button className="foot-signout" title={t("nav.signout")} type="submit"><Icon name="close" size={15} /></button>
        </form>
      </div>
    </aside>
  );
}
