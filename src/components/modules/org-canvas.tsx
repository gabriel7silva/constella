"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setReportsToByHandle, saveOrgLayout, deleteAgent } from "@/server/agents";
import { HireAgentButton } from "@/components/modules/hire-agent";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/status-dot";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n-context";

export type OrgAgent = {
  id: string;
  handle: string;
  name: string;
  role: string;
  color: string;
  reportsTo: string | null; // manager's HANDLE (see db/seed.ts)
  health: "alive" | "stale" | "down";
  status: string;
  origin?: string; // "hired" agents can be fired from the canvas
  orgX?: number | null;
  orgY?: number | null;
};

const CW = 184, CH = 58, GAPX = 36, GAPY = 96;

export function OrgCanvas({ agents }: { agents: OrgAgent[] }) {
  const t = useT();
  const router = useRouter();
  // initial managers from data (handle -> manager handle)
  const initialManagers = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.handle, a.reportsTo])) as Record<string, string | null>,
    [agents],
  );

  // tier layout for initial positions
  const initialPos = useMemo(() => {
    const childrenOf = (h: string | null) => agents.filter((a) => initialManagers[a.handle] === h);
    const root = agents.find((a) => initialManagers[a.handle] === null) ?? agents[0];
    const rows: string[][] = [];
    if (root) {
      (function walk(h: string, d: number) {
        (rows[d] ??= []).push(h);
        childrenOf(h).forEach((c) => walk(c.handle, d + 1));
      })(root.handle, 0);
    }
    const pos: Record<string, { x: number; y: number }> = {};
    rows.forEach((row, d) => {
      const totalW = row.length * CW + (row.length - 1) * GAPX;
      row.forEach((h, i) => {
        pos[h] = { x: 40 + i * (CW + GAPX) + Math.max(0, (760 - totalW) / 2), y: 30 + d * GAPY };
      });
    });
    // any agent unreachable from root (orphan / dangling manager) gets a slot too
    let off = rows.length;
    agents.forEach((a) => {
      if (!pos[a.handle]) {
        pos[a.handle] = { x: 40, y: 30 + off * GAPY };
        off += 1;
      }
    });
    // a persisted drag position (agent.orgX/orgY) overrides the computed tier slot
    agents.forEach((a) => {
      if (typeof a.orgX === "number" && typeof a.orgY === "number") pos[a.handle] = { x: a.orgX, y: a.orgY };
    });
    return pos;
  }, [agents, initialManagers]);

  const [managers, setManagers] = useState<Record<string, string | null>>(initialManagers);
  const [pos, setPos] = useState(initialPos);
  const [drag, setDrag] = useState<{ handle: string; dx: number; dy: number } | null>(null);
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null);
  const [fireTarget, setFireTarget] = useState<OrgAgent | null>(null);
  const [firing, setFiring] = useState(false);
  const [fireErr, setFireErr] = useState("");
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A freshly-hired agent appears in `agents` (→ initialPos) but `pos` state was seeded once and won't
  // include it — merge any new handles in so its card renders + drags (without clobbering dragged spots).
  useEffect(() => {
    setPos((cur) => {
      const add = Object.keys(initialPos).filter((h) => !(h in cur));
      return add.length ? { ...cur, ...Object.fromEntries(add.map((h) => [h, initialPos[h]])) } : cur;
    });
  }, [initialPos]);

  function rel(e: React.MouseEvent | MouseEvent) {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left + wrapRef.current!.scrollLeft, y: e.clientY - r.top + wrapRef.current!.scrollTop };
  }
  function onDown(e: React.MouseEvent, h: string) {
    if ((e.target as HTMLElement).closest(".oc-link")) return;
    const p = rel(e);
    const at = pos[h] ?? initialPos[h] ?? { x: 40, y: 30 }; // guard: a just-hired card may not be in pos yet
    setDrag({ handle: h, dx: p.x - at.x, dy: p.y - at.y });
  }
  function onLinkDown(e: React.MouseEvent, h: string) {
    e.stopPropagation();
    const p = rel(e);
    setLink({ from: h, x: p.x, y: p.y });
  }
  function onMove(e: React.MouseEvent) {
    if (drag) {
      const p = rel(e);
      setPos((s) => ({ ...s, [drag.handle]: { x: p.x - drag.dx, y: p.y - drag.dy } }));
    } else if (link) {
      const p = rel(e);
      setLink((s) => s && { ...s, x: p.x, y: p.y });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el && (el.closest("[data-h]") as HTMLElement | null);
      setHoverTarget(card && card.dataset.h !== link.from ? card.dataset.h! : null);
    }
  }
  async function onUp() {
    if (link && hoverTarget) {
      const target = hoverTarget, from = link.from;
      setManagers((m) => ({ ...m, [target]: from }));
      await setReportsToByHandle(target, from);
    }
    if (drag) {
      const p = pos[drag.handle];
      if (p) void saveOrgLayout(drag.handle, p.x, p.y); // persist the dragged position
    }
    setDrag(null);
    setLink(null);
    setHoverTarget(null);
  }
  function resetOrg() {
    setManagers(initialManagers);
    setPos(initialPos);
  }
  async function unlink(h: string) {
    setManagers((m) => ({ ...m, [h]: null }));
    await setReportsToByHandle(h, null);
  }
  async function confirmFire() {
    if (!fireTarget) return;
    setFiring(true); setFireErr("");
    const r = await deleteAgent(fireTarget.id);
    setFiring(false);
    if (r.ok) { setFireTarget(null); router.refresh(); } else { setFireErr(r.error || t("agent.fire.error")); }
  }

  function anchorPoints(f: { x: number; y: number }, t: { x: number; y: number }) {
    const fcx = f.x + CW / 2, fcy = f.y + CH / 2, tcx = t.x + CW / 2, tcy = t.y + CH / 2;
    const dx = tcx - fcx, dy = tcy - fcy;
    function sideOf(c: { x: number; y: number }, towardX: number, towardY: number, horizontal: boolean) {
      if (horizontal) return towardX > 0 ? { x: c.x + CW, y: c.y + CH / 2, nx: 1, ny: 0 } : { x: c.x, y: c.y + CH / 2, nx: -1, ny: 0 };
      return towardY > 0 ? { x: c.x + CW / 2, y: c.y + CH, nx: 0, ny: 1 } : { x: c.x + CW / 2, y: c.y, nx: 0, ny: -1 };
    }
    const horizontal = Math.abs(dx) > Math.abs(dy) + 30;
    const a = sideOf(f, dx, dy, horizontal);
    const b = sideOf(t, -dx, -dy, horizontal);
    return { a, b };
  }
  function edge(fromH: string, toH: string) {
    const f = pos[fromH], t = pos[toH];
    if (!f || !t) return null;
    const { a, b } = anchorPoints(f, t);
    const k = 0.5 * Math.hypot(b.x - a.x, b.y - a.y);
    const c1x = a.x + a.nx * k, c1y = a.y + a.ny * k;
    const c2x = b.x + b.nx * k, c2y = b.y + b.ny * k;
    return `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`;
  }

  return (
    <div className="view" style={{ padding: 0 }}>
      <div className="view-head" style={{ padding: "18px 24px 14px" }}>
        <div className="vh-icon"><Icon name="agents" size={20} /></div>
        <div>
          <div className="view-title">{t("org.title")}</div>
          <div className="view-sub">{t("org.canvas.sub")}</div>
        </div>
        <div className="vh-right">
          <HireAgentButton agents={agents.map((a) => ({ handle: a.handle, name: a.name }))} />
          <button className="btn-ghost" onClick={resetOrg}><Icon name="refresh" size={13} /> {t("org.resetLayout")}</button>
        </div>
      </div>
      <div className="orgcanvas-wrap">
        <div className="orgcanvas-bar">
          <span className="orgcanvas-hint">
            <Icon name="bot" size={13} style={{ color: "var(--accent)" }} /> {t("org.hint.pre")} <b style={{ color: "var(--accent)", margin: "0 3px" }}>●</b> {t("org.hint.post")}
          </span>
        </div>
        <div className="orgcanvas" ref={wrapRef} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <svg className="org-svg">
            {agents.map((a) => {
              const m = managers[a.handle];
              const d = m ? edge(m, a.handle) : null;
              return d ? <path key={a.handle} d={d} /> : null;
            })}
            {link && <path className="temp" d={`M ${pos[link.from].x + CW / 2} ${pos[link.from].y + CH} L ${link.x} ${link.y}`} />}
          </svg>
          {agents.map((a) => {
            const p = pos[a.handle] ?? { x: 0, y: 0 };
            const isCeo = managers[a.handle] === null;
            const mgr = managers[a.handle];
            return (
              <div
                key={a.handle}
                data-h={a.handle}
                className={"org-card" + (isCeo ? " ceo" : "") + (drag && drag.handle === a.handle ? " dragging" : "") + (hoverTarget === a.handle ? " linktarget" : "") + (link && link.from === a.handle ? " linking" : "")}
                style={{ left: p.x, top: p.y }}
                onMouseDown={(e) => onDown(e, a.handle)}
              >
                <Avatar name={a.name} color={a.color} size={32} health={a.health} />
                <div style={{ minWidth: 0 }}>
                  <div className="oc-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>{a.name} {a.status !== "idle" && <StatusDot status={a.status} />}</div>
                  <div className="oc-role">{a.role}</div>
                </div>
                <div className="oc-link" title={t("org.dragOntoSubordinate")} onMouseDown={(e) => onLinkDown(e, a.handle)}>
                  <Icon name="add" size={11} />
                </div>
                {a.origin === "hired" && (
                  <div className="oc-link" title={t("agent.fire.button")} style={{ left: 6, right: "auto", color: "var(--sx-keyword)" }} onMouseDown={(e) => { e.stopPropagation(); setFireErr(""); setFireTarget(a); }}>
                    <Icon name="trash" size={11} />
                  </div>
                )}
                {mgr && (
                  <div
                    className="oc-unlink"
                    title={t("org.unlinkFrom", { handle: "@" + mgr })}
                    onMouseDown={(e) => { e.stopPropagation(); void unlink(a.handle); }}
                  >
                    <Icon name="close" size={11} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {fireTarget && (
        <ConfirmDialog
          title={t("agent.fire.button")}
          body={t("agent.fire.confirm", { name: fireTarget.name })}
          confirmLabel={t("agent.fire.button")}
          error={fireErr}
          pending={firing}
          onConfirm={confirmFire}
          onCancel={() => { setFireTarget(null); setFireErr(""); }}
        />
      )}
    </div>
  );
}
