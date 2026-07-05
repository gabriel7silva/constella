import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agent, task, goal, skill, report, file } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { MODULES } from "@/lib/modules";
import { ViewShell } from "@/components/shell/view-shell";
import { SearchPalette, type SearchEntry } from "@/components/modules/search-palette";
import { getT } from "@/lib/i18n-server";

export default async function SearchPage() {
  const t = await getT();
  const { workspace } = await requireWorkspace();
  const [agents, tasks, goals, skills, reports, files] = await Promise.all([
    db.select().from(agent).where(eq(agent.workspaceId, workspace.id)),
    db.select().from(task).where(eq(task.workspaceId, workspace.id)),
    db.select().from(goal).where(eq(goal.workspaceId, workspace.id)),
    db.select().from(skill).where(eq(skill.workspaceId, workspace.id)),
    db.select().from(report).where(eq(report.workspaceId, workspace.id)),
    db.select().from(file).where(eq(file.workspaceId, workspace.id)),
  ]);

  // Each entry is a searchable "file" with one or more text lines (the haystack).
  // The island matches the query against `lines` and highlights the hits, 1:1 with the mock.
  const index: SearchEntry[] = [
    ...MODULES.map((m): SearchEntry => ({
      group: "Modules", name: m.title, path: m.href as string,
      ext: "md", href: m.href as string, lines: [m.title, m.tile],
    })),
    ...agents.map((a): SearchEntry => ({
      group: "Agents", name: a.name, path: `@${a.handle}`,
      ext: "ts", href: `/agents/${a.handle}`, lines: [a.name, a.role, `@${a.handle}`],
    })),
    ...tasks.map((t): SearchEntry => ({
      group: "Tasks", name: t.key, path: t.title,
      ext: "ts", href: "/tasks", lines: [t.key, t.title, t.description, t.col, t.prio].filter(Boolean),
    })),
    ...goals.map((g): SearchEntry => ({
      group: "Goals", name: g.title, path: `${g.progress}% complete`,
      ext: "ts", href: "/goals", lines: [g.title, g.description].filter(Boolean),
    })),
    ...skills.map((s): SearchEntry => ({
      group: "Skills", name: s.name, path: s.trigger || "skill",
      ext: "md", href: "/skills", lines: [s.name, s.summary, s.trigger].filter(Boolean),
    })),
    ...reports.map((r): SearchEntry => ({
      group: "Reports", name: r.title, path: r.type,
      ext: "md", href: `/reports/${r.id}`, lines: [r.title, r.type].filter(Boolean),
    })),
    ...files.map((f): SearchEntry => ({
      group: "Files", name: f.path.split("/").pop() ?? f.path, path: f.path,
      ext: f.lang, href: "/code", lines: f.content.split("\n"),
    })),
  ];

  return (
    <ViewShell title={t("search.title")} sub={t("search.sub")}>
      <SearchPalette index={index} empty={index.length === 0} />
    </ViewShell>
  );
}
