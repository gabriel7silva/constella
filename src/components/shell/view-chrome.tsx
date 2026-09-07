"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { MODULES } from "@/lib/modules";
import { useT } from "@/lib/i18n-context";

// Client view chrome (head + body). Contains NO server/db imports. Pages pass the ENGLISH module
// title (so the Topbar crumb + this lookup stay stable); the heading is translated here via the
// module map, so every screen heading is localized with no per-page wiring.
// Uses the prototype shell classes (.app-view/.view-head/.vh-icon/.view-title/.view-sub/.view-body).
export function ViewChrome({
  title,
  sub,
  right,
  icon,
  flush,
  children,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  icon?: IconName;
  flush?: boolean; // drop the body padding so a module (e.g. Design) fills the area edge-to-edge
  children: React.ReactNode;
}) {
  const t = useT();
  // Auto-resolve the module from the (pure, db-free) MODULES table by its English title, so every
  // header gets its accent icon + a localized title without per-page wiring. Explicit icon wins.
  const mod = MODULES.find((m) => m.title === title);
  const resolvedIcon = icon ?? mod?.icon;
  const displayTitle = mod ? t(`mod.${mod.id}`) : title;
  return (
    <div className="app-view">
      <div className="view-head">
        {resolvedIcon && (
          <div className="vh-icon">
            <Icon name={resolvedIcon} size={18} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="view-title">{displayTitle}</div>
          {sub && <div className="view-sub">{sub}</div>}
        </div>
        {right}
      </div>
      <div className="view-body" style={flush ? { padding: 0, overflow: "hidden" } : undefined}>{children}</div>
    </div>
  );
}
