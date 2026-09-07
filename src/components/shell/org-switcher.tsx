"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConstellaMark } from "@/components/ui/constella-mark";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import { setActiveOrg } from "@/server/actions/org-actions";

/** Sidebar org/workspace switcher — real org switching via session.activeOrgId. Mock markup. */
export function OrgSwitcher({ orgs, currentId, workspaceSlug }: {
  orgs: { id: string; name: string }[];
  currentId: string;
  workspaceSlug: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const cur = orgs.find((o) => o.id === currentId) || orgs[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function esc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", esc); };
  }, [open]);

  function switchOrg(id: string) {
    setOpen(false);
    if (id === currentId) return;
    // Switching org changes the ENTIRE workspace/data context — a router.refresh() left client state and
    // route-specific data (a goal/issue id that doesn't exist in the other org) stale. Hard-reload into the
    // new org's home so nothing carries over.
    start(async () => { await setActiveOrg(id); window.location.href = "/"; });
  }

  return (
    <div className="org-switch" ref={ref}>
      <button className={"org-switch-btn" + (open ? " open" : "")} disabled={pending} onClick={() => setOpen((o) => !o)} title={cur?.name}>
        <ConstellaMark size={34} rx={10} />
        <div className="os-meta"><div className="os-name">{cur?.name ?? "Constella"}</div><div className="os-sub mono">{workspaceSlug}</div></div>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="org-pop">
          <div className="org-pop-h">{t("mod.organizations")}</div>
          {orgs.map((o, i) => (
            <button key={o.id} className={"org-pop-item" + (o.id === currentId ? " on" : "")} onClick={() => switchOrg(o.id)}>
              <span className="op-badge">{i + 1}</span>
              <span className="op-name">{o.name}</span>
              {o.id === currentId && <Icon name="check" size={14} />}
            </button>
          ))}
          <div className="org-pop-sep" />
          <button className="org-pop-create" onClick={() => { setOpen(false); router.push("/onboarding"); }}>
            <span className="opc-ic"><Icon name="add" size={13} /></span> {t("orgs.createOrganization")}
          </button>
        </div>
      )}
    </div>
  );
}
