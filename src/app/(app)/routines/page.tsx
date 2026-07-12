import { eq } from "drizzle-orm";
import { db } from "@/db";
import { routine, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Avatar } from "@/components/ui/avatar";
import { Toggle } from "@/components/modules/module-toggles";
import { NewRoutineButton, DeleteRoutineButton } from "@/components/modules/new-routine";
import { getT } from "@/lib/i18n-server";

type T = (key: string, vars?: Record<string, string | number>) => string;

function nextRun(freq: string, t: T): string {
  const f = freq.toLowerCase();
  if (/min/.test(f)) return t("routines.next.minutes");
  if (/hour|hourly/.test(f)) return t("routines.next.hour");
  if (/daily|day/.test(f)) return t("routines.next.tomorrow");
  if (/week/.test(f)) return t("routines.next.week");
  if (/month/.test(f)) return t("routines.next.month");
  return t("routines.next.schedule");
}

// Translate the four standard frequency enum values; pass any custom/agent-written freq through.
const STD_FREQS = new Set(["Hourly", "Daily", "Weekly", "Monthly"]);
function freqLabel(freq: string, t: T): string {
  return STD_FREQS.has(freq) ? t(`routines.freq.${freq}`) : freq;
}

export default async function RoutinesPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const rows = await db.select().from(routine).where(eq(routine.workspaceId, workspace.id));
  const agents = await db.select().from(agent).where(eq(agent.workspaceId, workspace.id));
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  return (
    <ViewShell title={t("mod.routines")} sub={t("routines.sub")}
      right={<NewRoutineButton agents={agents.map((a) => ({ id: a.id, name: a.name }))} />}>
      {rows.length === 0 && <div className="card"><div className="muted">{t("routines.empty")}</div></div>}
      {rows.map((r) => {
        const a = r.agentId ? byId[r.agentId] : null;
        return (
          <div className="lrow" key={r.id}>
            {a ? <Avatar name={a.name} color={a.color} size={28} /> : <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-active)", flex: "0 0 28px" }} />}
            <div className="lr-main">
              <div className="lr-title">{r.name}</div>
              <div className="lr-sub"><span className="lr-mono mono">{r.cmd}</span></div>
            </div>
            <div className="schedule-info" style={{ textAlign: "right", marginRight: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{freqLabel(r.freq, t)}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{t("routines.nextLabel")} {r.enabled ? nextRun(r.freq, t) : t("routines.paused")} · {t("routines.lastLabel")} —</div>
            </div>
            <Toggle kind="routine" id={r.id} on={r.enabled} />
            <DeleteRoutineButton id={r.id} />
          </div>
        );
      })}
    </ViewShell>
  );
}
