import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { task, taskStep, agent } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { NewTaskButton } from "@/components/modules/task-actions";
import { TaskBoard } from "@/components/modules/task-board";
import { getT } from "@/lib/i18n-server";

export default async function TasksPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [tasks, steps, agents] = await Promise.all([
    db.select().from(task).where(eq(task.workspaceId, workspace.id)),
    db.select().from(taskStep).where(eq(taskStep.workspaceId, workspace.id)).orderBy(asc(taskStep.ord)),
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
  ]);
  const stepsByTask = new Map<string, typeof steps>();
  for (const s of steps) { const arr = stepsByTask.get(s.taskId) ?? []; arr.push(s); stepsByTask.set(s.taskId, arr); }

  // Done cards drop off the board 24h after they were finalised (updatedAt is bumped on the move to
  // "done"), so the Done column stays a short "recently shipped" list instead of growing forever.
  const DAY_MS = 86_400_000;
  const visible = tasks.filter((r) => r.col !== "done" || !r.updatedAt || Date.now() - r.updatedAt.getTime() <= DAY_MS);

  return (
    <ViewShell title={t("mod.tasks")} sub={t("tasks.sub")}
               right={<NewTaskButton agents={agents.map((a) => ({ id: a.id, name: a.name, color: a.color }))} />}>
      <TaskBoard
        tasks={visible.map((t) => ({
          id: t.id, key: t.key, title: t.title, description: t.description, col: t.col, prio: t.prio, assigneeId: t.assigneeId,
          steps: (stepsByTask.get(t.id) ?? []).map((s) => ({ id: s.id, text: s.text, done: s.done, active: s.active })),
        }))}
        agents={agents.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
      />
    </ViewShell>
  );
}
