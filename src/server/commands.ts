import "server-only";
import { randomUUID as uid } from "node:crypto";
import { eq, and, desc, like } from "drizzle-orm";
import { db } from "@/db";
import { message, messageSummary, event, goal, issue, task, spec, workspace, agent } from "@/db/schema";
import { kbAnswer, runKbCuration, relatedKnowledge } from "@/server/kb";
import { indexRag, scheduleChatReindex } from "@/server/rag";
import { ensureActiveSession } from "@/server/sessions";
import { wake } from "@/server/bus";
import { approvePlanFor, setAuto247For, requestPlanChangesFor } from "@/server/plan-ops";
import { cancelGoalFor, archiveGoalFor } from "@/server/work-ops";
import { runTestDevAction } from "@/server/actions/test-dev-actions";
import { refreshGitStatus } from "@/server/github";
import { runDeployPipeline, exportCleanSource } from "@/server/prepare-deploy";
import { getTelegramConfig } from "@/lib/telegram";
import { ollamaInfo, llamaServerStatus } from "@/server/local-models";
import { allLibrarySkillNames } from "@/server/skills-library";
import { activeLocks } from "@/server/file-locks";
import { generatePlanFor } from "@/server/planner-core";
import { closeSprintFor } from "@/server/pm";

/**
 * Chat slash-commands. Parsed from a leading "/" in the message-send path (room + DM, not Telegram).
 * Commands run server-side and post their result back into the same thread; @mentions and the
 * [[CREATE_WORK]] token remain the conversational path. See docs/CHAT_COMMANDS.md.
 */

type AgentLite = {
  handle: string;
  name: string;
  role: string;
  status: string;
  health?: string | null;
  adapter?: string | null;
  model?: string | null;
};

const HELP = `Available commands:
- /help — this list
- /kb <question>  (alias /ask-kb) — ask the Knowledge Base; answers with references
- /status — active goals, open issues, tasks in flight
- /agents — the team roster
- /agent <handle> — inspect one agent + link to Agent Studio
- /new-goal <brief>  (alias /new-work) — start new work (the CEO drafts specs → issues → plan)
- /new-issue <title> · /new-spec <title> — create a single issue/spec on the board
- /approve — approve the pending plan (queues tasks)
- /run-247 (alias /resume) · /pause — turn 24/7 autonomous execution on / off
- /reject <reason> — send the plan back to the CEO
- /cancel · /archive — cancel / archive the active goal
- /search <q> — search the Knowledge Base
- /graph <key> — show the knowledge graph (connections) for a spec/issue/goal
- /reindex — rebuild the RAG/KB index now
- /curate — run Vannevar's KB curation pass (dedup / retire / summarise / gaps)
- /clear — wipe this conversation (asks you to confirm first)
- /test-dev — run the Test Dev validation gate · /review — ask the reviewer to review recent changes
- /github — refresh the repository status · /prepare-deploy — run the production-prep pipeline
- /export-source <repo> — export the clean product source · /generate-plan <brief> — draft a plan
- /assign <issue> <@agent> — assign an issue · /telegram — Telegram integration status
- /models — local model status · /skills — the skills library · /locks — file locks held
- /close-sprint — archive what shipped + write a sprint retro
Mention a teammate with @handle to talk to them directly.`;

async function postOp(wsId: string, channel: string, text: string, sessionId: string | null): Promise<void> {
  await db.insert(message).values({ id: uid(), workspaceId: wsId, channel, fromKind: "operator", text: text.slice(0, 4000), sessionId });
}
async function post(wsId: string, channel: string, fromHandle: string, text: string, sessionId: string | null, extra?: { kind?: string; sources?: string[] }): Promise<void> {
  await db.insert(message).values({ id: uid(), workspaceId: wsId, channel, fromKind: "agent", fromHandle, text: text.slice(0, 4000), createdAt: new Date(), sessionId, kind: extra?.kind ?? null, sources: extra?.sources?.length ? extra.sources : null });
}

/** Run a slash command. Returns whether it was handled + any agent handles that should reply next. */
export async function runSlashCommand(orgId: string, wsId: string, agents: AgentLite[], channel: string, raw: string): Promise<{ handled: boolean; responders: string[] }> {
  const sessionId = await ensureActiveSession(wsId, channel);
  const sp = raw.indexOf(" ");
  const cmd = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase();
  const rest = (sp === -1 ? "" : raw.slice(sp + 1)).trim();
  const done = (responders: string[] = []) => { wake(wsId); return { handled: true, responders }; };

  switch (cmd) {
    case "/help":
      await postOp(wsId, channel, raw, sessionId);
      await post(wsId, channel, "system", HELP, sessionId);
      return done();

    case "/kb":
    case "/ask-kb": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "vannevar", "Ask a question, e.g. `/kb how does the calculation engine work?`", sessionId); return done(); }
      const a = await kbAnswer(orgId, rest);
      await post(wsId, channel, "vannevar", a.text, sessionId, { kind: a.mode === "overview" ? "kb-card" : undefined, sources: a.sources });
      scheduleChatReindex(orgId);
      return done();
    }

    case "/reindex": {
      await postOp(wsId, channel, raw, sessionId);
      const r = await indexRag(orgId);
      await post(wsId, channel, "vannevar", `Reindexed the knowledge base — ${r.chunks} chunk(s)${r.embedded ? " (semantic)" : " (keyword fallback — embed server down)"}.`, sessionId);
      return done();
    }

    case "/curate": {
      await postOp(wsId, channel, raw, sessionId);
      const r = await runKbCuration(orgId);
      const changed = r.merged + r.retired + r.summarized;
      await post(wsId, channel, "vannevar", (r.ok || changed > 0)
        ? `Curated the KB — merged ${r.merged}, retired ${r.retired}, re-summarised ${r.summarized}, ${r.gaps} gap(s). Details in Reports/kb-health.md.`
        : "Nothing to curate right now (needs a few entries + available budget).", sessionId);
      return done();
    }

    case "/clear": {
      await postOp(wsId, channel, raw, sessionId);
      if (!/^(confirm|yes|sim)$/i.test(rest)) {
        await post(wsId, channel, "system", "⚠️ **/clear** permanently deletes EVERY message in this conversation — the full history, the compacted context summary and the run events. The agents lose this conversation's context (your board work, goals, specs and the Knowledge Base are NOT affected). Type `/clear confirm` to proceed.", sessionId);
        return done();
      }
      const before = (await db.select({ id: message.id }).from(message).where(and(eq(message.workspaceId, wsId), eq(message.channel, channel)))).length;
      await db.delete(message).where(and(eq(message.workspaceId, wsId), eq(message.channel, channel)));
      await db.delete(messageSummary).where(and(eq(messageSummary.workspaceId, wsId), eq(messageSummary.channel, channel)));
      await db.delete(event).where(and(eq(event.workspaceId, wsId), eq(event.channel, channel)));
      await post(wsId, channel, "system", `✓ Conversation cleared — ${before} message(s) removed.`, sessionId, { kind: "cleared" });
      return done();
    }

    case "/status": {
      await postOp(wsId, channel, raw, sessionId);
      const [goals, issues, doing] = await Promise.all([
        db.select({ status: goal.status }).from(goal).where(eq(goal.workspaceId, wsId)),
        db.select({ col: issue.col }).from(issue).where(eq(issue.workspaceId, wsId)),
        db.select({ id: task.id }).from(task).where(and(eq(task.workspaceId, wsId), eq(task.col, "doing"))),
      ]);
      const activeGoals = goals.filter((g) => g.status === "active").length;
      const openIssues = issues.filter((i) => i.col !== "done").length;
      await post(wsId, channel, "system", `Status — ${activeGoals} active goal(s) · ${openIssues} open issue(s) · ${doing.length} task(s) in flight.`, sessionId);
      return done();
    }

    case "/agents": {
      await postOp(wsId, channel, raw, sessionId);
      const list = agents.map((a) => `@${a.handle} — ${a.name} (${a.role}, ${a.status})`).join("\n");
      await post(wsId, channel, "system", `Team:\n${list || "(none)"}`, sessionId);
      return done();
    }

    case "/agent": {
      await postOp(wsId, channel, raw, sessionId);
      const handle = rest.replace(/^@/, "").trim().toLowerCase();
      if (!handle) {
        await post(wsId, channel, "system", "Usage: `/agent <handle>` - e.g. `/agent ada`.", sessionId);
        return done();
      }
      const a = agents.find((x) => x.handle.toLowerCase() === handle);
      if (!a) {
        await post(wsId, channel, "system", `No agent @${handle} on the roster. Use \`/agents\` to see the team.`, sessionId);
        return done();
      }
      const runtime = [a.adapter || "unknown adapter", a.model || ""].filter(Boolean).join(" / ");
      const health = a.health ? ` / health: ${a.health}` : "";
      await post(wsId, channel, a.handle, [
        `**${a.name}** (@${a.handle})`,
        `Role: ${a.role}`,
        `Status: ${a.status}${health}`,
        `Runtime: ${runtime}`,
        "",
        `[Open in Agent Studio](/agents/${a.handle})`,
      ].join("\n"), sessionId, { kind: "agent-card" });
      return done();
    }

    case "/new-goal":
    case "/new-work": {
      if (!rest) { await postOp(wsId, channel, raw, sessionId); await post(wsId, channel, "system", "Describe the work, e.g. `/new-goal a billing page with payment-provider checkout`.", sessionId); return done(); }
      // Hand the brief to the CEO via the normal new-work pipeline (brief → specs → issues → plan).
      await postOp(wsId, channel, `@ada ${rest}`, sessionId);
      scheduleChatReindex(orgId);
      return done(["ada"]);
    }

    case "/approve": {
      await postOp(wsId, channel, raw, sessionId);
      const [ws] = await db.select().from(workspace).where(eq(workspace.id, wsId));
      if (!ws) { await post(wsId, channel, "system", "No workspace found.", sessionId); return done(); }
      const r = await approvePlanFor(orgId, ws); // shared core (also used by Telegram + the public API)
      await post(wsId, channel, "system", `✅ Plan approved — ${r.made} task(s) queued. Use \`/run-247\` to start autonomous execution.`, sessionId);
      return done();
    }

    case "/reject": {
      await postOp(wsId, channel, raw, sessionId);
      await requestPlanChangesFor(wsId, rest || undefined);
      await post(wsId, channel, "system", rest ? "↩️ Plan sent back to the CEO — reason recorded." : "↩️ Plan sent back to the CEO for revision.", sessionId);
      return done();
    }

    case "/run-247":
    case "/resume": {
      await postOp(wsId, channel, raw, sessionId);
      await setAuto247For(wsId, true);
      await post(wsId, channel, "system", "▶️ 24/7 autonomous execution is ON — the team will work the board.", sessionId);
      return done();
    }

    case "/pause": {
      await postOp(wsId, channel, raw, sessionId);
      await setAuto247For(wsId, false);
      await post(wsId, channel, "system", "⏸ 24/7 autonomous execution paused.", sessionId);
      return done();
    }

    case "/cancel":
    case "/archive": {
      await postOp(wsId, channel, raw, sessionId);
      const [g] = await db.select({ id: goal.id, title: goal.title }).from(goal)
        .where(and(eq(goal.workspaceId, wsId), eq(goal.status, "active"))).orderBy(desc(goal.createdAt)).limit(1);
      if (!g) { await post(wsId, channel, "system", `No active goal to ${cmd === "/cancel" ? "cancel" : "archive"}.`, sessionId); return done(); }
      if (cmd === "/cancel") { const r = await cancelGoalFor(wsId, g.id); await post(wsId, channel, "system", r.ok ? `🛑 Cancelled — ${r.title}. Execution stopped; reopen it in Goals to resume.` : "Couldn't cancel the goal.", sessionId); }
      else { const r = await archiveGoalFor(orgId, wsId, g.id); await post(wsId, channel, "system", r.ok ? `📦 Archived — ${r.title} → ${r.path}.` : "Couldn't archive the goal.", sessionId); }
      return done();
    }

    case "/new-issue": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "system", "Give a title, e.g. `/new-issue add a logout button`.", sessionId); return done(); }
      const n = (await db.select({ id: issue.id }).from(issue).where(eq(issue.workspaceId, wsId))).length;
      const key = String(n + 1);
      await db.insert(issue).values({ id: uid(), workspaceId: wsId, key, title: rest.slice(0, 200), col: "todo", prio: "med" });
      await post(wsId, channel, "system", `📝 Issue #${key} created — ${rest.slice(0, 120)}. Open the Product Manager to size + assign it.`, sessionId);
      return done();
    }

    case "/new-spec": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "system", "Give a title, e.g. `/new-spec billing architecture`.", sessionId); return done(); }
      const n = (await db.select({ id: spec.id }).from(spec).where(eq(spec.workspaceId, wsId))).length;
      const key = `SPEC-${String(n + 1).padStart(2, "0")}`;
      await db.insert(spec).values({ id: uid(), workspaceId: wsId, key, title: rest.slice(0, 200) });
      await post(wsId, channel, "system", `📄 Spec ${key} created — ${rest.slice(0, 120)}.`, sessionId);
      return done();
    }

    case "/search": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "vannevar", "Search what? e.g. `/search how does auth work`.", sessionId); return done(); }
      const a = await kbAnswer(orgId, rest);
      await post(wsId, channel, "vannevar", a.text, sessionId, { kind: a.mode === "overview" ? "kb-card" : undefined, sources: a.sources });
      scheduleChatReindex(orgId);
      return done();
    }

    case "/graph": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "vannevar", "Give a spec/issue key or a goal title, e.g. `/graph SPEC-01`.", sessionId); return done(); }
      const [sp] = await db.select({ id: spec.id }).from(spec).where(and(eq(spec.workspaceId, wsId), eq(spec.key, rest)));
      const [iss] = sp ? [undefined] : await db.select({ id: issue.id }).from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.key, rest)));
      const [gl] = (sp || iss) ? [undefined] : await db.select({ id: goal.id }).from(goal).where(and(eq(goal.workspaceId, wsId), like(goal.title, `%${rest}%`)));
      const seed = sp ? { specId: sp.id } : iss ? { issueId: iss.id } : gl ? { goalId: gl.id } : null;
      if (!seed) { await post(wsId, channel, "vannevar", `No goal / spec / issue matches \`${rest}\`.`, sessionId); return done(); }
      const g = await relatedKnowledge(orgId, seed);
      if (!g || !g.nodes.length) { await post(wsId, channel, "vannevar", `No connected knowledge for \`${rest}\` yet — it grows as the team works.`, sessionId); return done(); }
      const body = Object.entries(g.byType).map(([t, ns]) => `**${t}** (${ns.length})\n${ns.slice(0, 8).map((n) => `- ${n.title}`).join("\n")}`).join("\n\n");
      await post(wsId, channel, "vannevar", `🕸️ Connections for \`${rest}\` — ${g.nodes.length} related item(s):\n\n${body}`, sessionId, { kind: "kb-card" });
      return done();
    }

    case "/test-dev": {
      await postOp(wsId, channel, raw, sessionId);
      await post(wsId, channel, "edsger", "🧪 Running the Test Dev validation gate…", sessionId);
      const r = await runTestDevAction();
      await post(wsId, channel, "edsger", `Test Dev — **${r.status}**.${r.summary ? ` ${r.summary}` : ""}`, sessionId);
      return done();
    }

    case "/github": {
      await postOp(wsId, channel, raw, sessionId);
      const r = await refreshGitStatus();
      await post(wsId, channel, "werner", r.ok ? `🐙 GitHub — ${r.changed} changed file(s) detected. Open the GitHub module to commit + push.` : "🐙 GitHub — couldn't read the repository status (is this a git repo?).", sessionId);
      return done();
    }

    case "/assign": {
      await postOp(wsId, channel, raw, sessionId);
      const m = rest.match(/^(\S+)\s+@?(\S+)$/);
      if (!m) { await post(wsId, channel, "system", "Usage: `/assign <issue-key> <@agent>` — e.g. `/assign 3 @margaret`.", sessionId); return done(); }
      const [, key, handle] = m;
      const [iss] = await db.select({ id: issue.id }).from(issue).where(and(eq(issue.workspaceId, wsId), eq(issue.key, key)));
      if (!iss) { await post(wsId, channel, "system", `No issue #${key} on the board.`, sessionId); return done(); }
      const [ag] = await db.select({ id: agent.id, name: agent.name }).from(agent).where(and(eq(agent.workspaceId, wsId), eq(agent.handle, handle.toLowerCase())));
      if (!ag) { await post(wsId, channel, "system", `No agent @${handle.toLowerCase()} on the roster.`, sessionId); return done(); }
      await db.update(issue).set({ assigneeId: ag.id }).where(eq(issue.id, iss.id));
      await post(wsId, channel, "system", `👤 Issue #${key} assigned to ${ag.name} (@${handle.toLowerCase()}).`, sessionId);
      return done();
    }

    case "/review": {
      const rev = agents.find((a) => /cybersec|security|qa/i.test(a.role)) ?? agents.find((a) => a.handle === "whitfield");
      if (!rev) { await postOp(wsId, channel, raw, sessionId); await post(wsId, channel, "system", "No reviewer agent (CyberSec/QA) on the roster.", sessionId); return done(); }
      await postOp(wsId, channel, `@${rev.handle} review the recent changes on the board${rest ? `: ${rest}` : ""}.`, sessionId);
      return done([rev.handle]);
    }

    case "/prepare-deploy": {
      await postOp(wsId, channel, raw, sessionId);
      await post(wsId, channel, "werner", "🚀 Running the Prepare-Deploy pipeline — this can take a minute; live progress is in the Prepare Deploy module.", sessionId);
      const r = await runDeployPipeline();
      await post(wsId, channel, "werner", `Prepare-Deploy — **${r.status}**.${r.summary ? ` ${r.summary}` : ""}`, sessionId);
      return done();
    }

    case "/export-source": {
      await postOp(wsId, channel, raw, sessionId);
      if (!rest) { await post(wsId, channel, "system", "Usage: `/export-source <github-repo>` — e.g. `/export-source myorg/constella-public`.", sessionId); return done(); }
      const r = await exportCleanSource({ repo: rest.split(/\s+/)[0] });
      await post(wsId, channel, "werner", r.ok
        ? `📦 Exported the clean source${r.sha ? ` (${r.sha.slice(0, 7)})` : ""}${r.copied ? ` — ${r.copied} file(s)` : ""}.`
        : r.blocked ? `🛑 Export blocked — ${r.secrets?.length ?? 0} secret finding(s). Resolve them first.` : `Export failed${r.error ? ` — ${r.error}` : ""}.`, sessionId);
      return done();
    }

    case "/telegram": {
      await postOp(wsId, channel, raw, sessionId);
      const cfg = await getTelegramConfig(wsId);
      await post(wsId, channel, "system", cfg
        ? `📲 Telegram is configured — bot connected, alerts route to the allowlisted chat${cfg.allowedName ? ` (${cfg.allowedName})` : ""}.`
        : "📲 Telegram is not configured. Add a bot token + chat id in Settings → Integrations.", sessionId);
      return done();
    }

    case "/models": {
      await postOp(wsId, channel, raw, sessionId);
      const [oll, srv] = await Promise.all([ollamaInfo(), llamaServerStatus()]);
      const parts = [
        srv.up ? `llama.cpp: up${srv.model ? ` (${srv.model})` : ""}` : "llama.cpp: down",
        oll.up ? `Ollama: up — ${oll.models.length} model(s)${oll.models.length ? `: ${oll.models.slice(0, 6).map((m) => m.name).join(", ")}` : ""}` : "Ollama: not running",
      ];
      await post(wsId, channel, "system", `🧠 Local models — ${parts.join(" · ")}. Browse + download in the Models module.`, sessionId);
      return done();
    }

    case "/skills": {
      await postOp(wsId, channel, raw, sessionId);
      const names = allLibrarySkillNames();
      await post(wsId, channel, "system", `📚 Skills library — ${names.length} skill(s). Sample: ${names.slice(0, 12).join(", ")}${names.length > 12 ? " …" : ""}. Enable/disable per agent in Agent Studio → Skills.`, sessionId);
      return done();
    }

    case "/locks": {
      await postOp(wsId, channel, raw, sessionId);
      const locks = await activeLocks(wsId);
      await post(wsId, channel, "system", locks.length
        ? `🔒 ${locks.length} file lock(s) held:\n${locks.slice(0, 15).map((l) => `- \`${l.path}\` — @${l.agentHandle}`).join("\n")}`
        : "🔓 No file locks held right now.", sessionId);
      return done();
    }

    case "/generate-plan": {
      await postOp(wsId, channel, raw, sessionId);
      const [ws] = await db.select().from(workspace).where(eq(workspace.id, wsId));
      if (!ws) { await post(wsId, channel, "system", "No workspace found.", sessionId); return done(); }
      const r = await generatePlanFor(orgId, ws, rest ? { brief: rest } : undefined);
      await post(wsId, channel, "ada", r.ok
        ? "🧭 Plan generation started — drafting specs → issues → TODOs; it'll appear in the CEO Planner for your approval."
        : `Couldn't start plan generation${r.error ? ` — ${r.error}` : ""}.`, sessionId);
      return done();
    }

    case "/close-sprint": {
      await postOp(wsId, channel, raw, sessionId);
      const r = await closeSprintFor(orgId, wsId);
      await post(wsId, channel, "donald", r.ok
        ? `🏁 Sprint closed — ${r.shipped} shipped, ${r.carried} carried over. Retro written to \`${r.path}\`.`
        : "Nothing to close — no issues are in Done yet.", sessionId);
      return done();
    }

    default:
      await postOp(wsId, channel, raw, sessionId);
      await post(wsId, channel, "system", `Unknown command \`${cmd}\`. Try \`/help\`.`, sessionId);
      return done();
  }
}
