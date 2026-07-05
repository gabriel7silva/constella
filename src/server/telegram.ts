import "server-only";
import { randomUUID as uid } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { workspace, message, agent, goal } from "@/db/schema";
import { orgRoot } from "@/lib/fs-workspace";
import { integrationOn } from "@/lib/integrations";
import { getTelegramConfig, tgGetUpdates, tgGetFile, sendTelegramTo, tgSendChatAction, tgAnswerCallback, tgClearButtons, tgSetMyCommands, type TgUpdate, type TgConfig, type TgCallbackQuery } from "@/lib/telegram";
import { replyInChannel } from "@/server/collab";
import { wake } from "@/server/bus";
import { approvePlanFor, setAuto247For, requestPlanChangesFor, planStatusFor, reviewSummaryFor, tasksListFor } from "@/server/plan-ops";
import { cancelGoalFor, archiveGoalFor } from "@/server/work-ops";
import { planFromConversationFor } from "@/server/planner-core";
import { handoffToExecutionFor, designSummaryFor } from "@/server/design/actions";
import { kbAnswer } from "@/server/kb";
import { scrubSecrets } from "@/lib/scrub";

const TG_CHANNEL = "telegram"; // dedicated, isolated channel — never room/dm (no context bleed)
// Per-workspace "↩️ Reject tapped → next free-text message is the reason" wait flag. In-memory is
// fine: the poll runs in the single Next server process, so it survives across poll cycles; a server
// restart just drops a pending wait (operator re-taps). Keyed by workspace id.
const awaitingReason = new Set<string>();
// Same idea for "↩️ Request changes" on a DESIGN review: the next free-text message is what to change → routed
// to Grace in the Design module (recorded on the design channel).
const awaitingDesignReason = new Set<string>();
// Bots whose "/" command menu was already registered this process (setMyCommands once per bot). Ensures
// an ALREADY-connected bot (registered before setMyCommands existed) still gets its menu on the next poll.
const commandsRegistered = new Set<string>();

type Ws = typeof workspace.$inferSelect;

// Secret scrub now lives in @/lib/scrub (shared across Telegram, the team room, DMs and the API).

/**
 * Mirror an agent reply (composed in the in-app Telegram tab) OUT to the real Telegram chat,
 * so the bot conversation stays a single thread regardless of where the operator typed. Secrets
 * are scrubbed first. No-op when Telegram isn't configured for this workspace.
 */
export async function mirrorToTelegram(workspaceId: string, text: string): Promise<void> {
  if (!text?.trim()) return;
  const cfg = await getTelegramConfig(workspaceId);
  if (!cfg) return;
  await sendTelegramTo(cfg.botToken, cfg.chatId, scrubSecrets(text, [cfg.botToken]));
}

/**
 * Poll every workspace whose Telegram bot is configured + the integration is on, ingest the
 * allowed operator's messages, and reply as the CEO. Called by the worker on an interval (the
 * getUpdates call itself long-polls ~25s). Allowlist + isolation + injection guards apply.
 */
export async function pollTelegram(): Promise<{ updates: number }> {
  const wss = await db.select().from(workspace);
  let total = 0;
  for (const ws of wss) {
    const settings = (ws.settings ?? {}) as { integrations?: Record<string, boolean>; telegram?: { offset?: number } };
    if (!integrationOn(settings.integrations, "telegram")) continue;
    const cfg = await getTelegramConfig(ws.id);
    if (!cfg) continue;
    if (!commandsRegistered.has(cfg.botToken)) { void tgSetMyCommands(cfg.botToken).then(() => commandsRegistered.add(cfg.botToken)).catch(() => {}); } // mark registered only AFTER success, so a boot-time blip retries next poll
    const offset = settings.telegram?.offset ?? 0;
    const updates = await tgGetUpdates(cfg.botToken, offset);
    let maxId = offset;
    for (const u of updates) {
      // Advance the offset ONLY after a successful ingest, and stop at the first failure — otherwise a
      // transient ingest error (DB write, attachment fetch) would still persist the offset past that update
      // and Telegram would never re-deliver it, silently dropping the operator's message/command.
      try { await ingest(ws, cfg, u); maxId = Math.max(maxId, u.update_id + 1); }
      catch (e) { console.error("[telegram] ingest failed:", e); break; }
    }
    if (maxId !== offset) {
      await db.update(workspace).set({ settings: { ...settings, telegram: { ...(settings.telegram ?? {}), offset: maxId } } }).where(eq(workspace.id, ws.id));
    }
    total += updates.length;
  }
  return { updates: total };
}

async function ingest(ws: Ws, cfg: TgConfig, u: TgUpdate): Promise<void> {
  // Inline-button taps (the P4 remote control) arrive as callback_query, not a message.
  if (u.callback_query) { await handleCallback(ws, cfg, u.callback_query); return; }
  const m = u.message;
  if (!m) return;
  // ALLOWLIST — only the one registered private chat may talk to the agent. Match BOTH the chat id
  // and the sender's user id (in a private chat they're equal); anything else is ignored silently.
  if (String(m.chat.id) !== String(cfg.chatId)) return;
  if (m.from && String(m.from.id) !== String(cfg.chatId)) return;

  const text = (m.text ?? m.caption ?? "").slice(0, 4000);
  const attachments: { name: string; type: string; size: number; path: string }[] = [];
  const root = orgRoot(ws.orgId);
  const dlId = uid().slice(0, 8);
  const save = async (fileId: string, name: string, type: string) => {
    const f = await tgGetFile(cfg.botToken, fileId);
    if (!f) return;
    const safe = (name.replace(/[^\w.\-]+/g, "_").slice(-60)) || `file.${f.ext}`;
    const rel = `uploads/tg-${dlId}/${safe}`;
    try { mkdirSync(join(root, `uploads/tg-${dlId}`), { recursive: true }); writeFileSync(join(root, rel), f.buf); attachments.push({ name: safe, type, size: f.buf.length, path: rel }); } catch { /* skip */ }
  };
  if (m.photo?.length) await save(m.photo[m.photo.length - 1].file_id, "photo.jpg", "image/jpeg");
  if (m.document) await save(m.document.file_id, m.document.file_name ?? "document", m.document.mime_type ?? "application/octet-stream");
  if (!text && attachments.length === 0) return;

  // Persist the operator turn in the ISOLATED telegram channel (also shows in the in-app view).
  await db.insert(message).values({ id: uid(), workspaceId: ws.id, channel: TG_CHANNEL, fromKind: "operator", text: text || "(attachment)", attachments: attachments.length ? attachments : null });
  wake(ws.id);

  // P4b — if the operator tapped "↩️ Reject" and we're waiting for the reason, this free-text
  // message IS the reason (a slash command instead falls through and clears the wait).
  if (awaitingReason.has(ws.id) && text && !text.startsWith("/")) {
    awaitingReason.delete(ws.id);
    await requestPlanChangesFor(ws.id, text);
    await tgSay(ws, cfg, "↩️ Recorded — the CEO will revise the plan with your reason.");
    return;
  }
  // Design change request: record it on the design channel so Grace picks it up when the operator opens Design.
  if (awaitingDesignReason.has(ws.id) && text && !text.startsWith("/")) {
    awaitingDesignReason.delete(ws.id);
    try { await db.insert(message).values({ id: uid(), workspaceId: ws.id, channel: "design", fromKind: "operator", text: `Change request (via Telegram): ${text}` }); } catch { /* best effort */ }
    await tgSay(ws, cfg, "📝 Recorded — open the Design module and Grace will apply your changes, then Send to execution.");
    return;
  }

  // P4 — slash-commands are a remote control: run a real action here instead of asking the CEO.
  if (text.startsWith("/")) { await handleCommand(ws, cfg, text); return; }

  // CEO (Ada) replies — replyInChannel adds the Telegram injection-guard for this channel.
  await runCeoReply(ws, cfg);
}

/** Run the CEO (Ada) reply for the current telegram channel state, with a live "typing…" indicator.
 *  Shared by the normal inbound path and the /new command (which seeds a brief then runs this). */
async function runCeoReply(ws: Ws, cfg: TgConfig): Promise<void> {
  const ada = (await db.select().from(agent).where(and(eq(agent.workspaceId, ws.id), eq(agent.handle, "ada"))))[0]
    ?? (await db.select().from(agent).where(eq(agent.workspaceId, ws.id)))[0];
  if (!ada) return;
  await db.update(agent).set({ status: "working" }).where(eq(agent.id, ada.id));
  // Show "typing…" on the phone while Ada's CLI generates the reply. Telegram clears the indicator
  // after ~5s, so keep it alive on a 4s heartbeat until the reply is ready.
  await tgSendChatAction(cfg.botToken, cfg.chatId, "typing");
  const beat = setInterval(() => { tgSendChatAction(cfg.botToken, cfg.chatId, "typing").catch(() => {}); }, 4000);
  let reply = "", planRequested = false;
  try { ({ text: reply, planRequested } = await replyInChannel(ws.orgId, ws, TG_CHANNEL, ada, "chat")); }
  finally { clearInterval(beat); }
  await db.update(agent).set({ status: "idle" }).where(eq(agent.id, ada.id));
  if (reply) await sendTelegramTo(cfg.botToken, cfg.chatId, scrubSecrets(reply, [cfg.botToken]));
  // New work born from the Telegram chat: when Ada determined this is a build/fix request she emitted
  // the CREATE_WORK token → run the SAME planning ritual as the web path (specs → issues → TODOs).
  if (planRequested) {
    const r = await planFromConversationFor(ws.orgId, ws, TG_CHANNEL);
    await tgSay(ws, cfg, r.ok
      ? "📝 Got it — drafting the plan now (specs · issues · TODOs); it'll appear in the CEO Planner for your approval, and I'll post here when it's ready."
      : `I couldn't start a plan from this yet${r.error ? ` (${r.error})` : ""} — add a little more detail and I'll try again.`);
  }
}

/* ----------------------------------------------------------- P4: remote control (commands + buttons) */

const TG_HELP = `Remote control:
/status — quick status
/review — full plan / issues / tasks summary
/tasks — what's in flight right now
/approve — approve the pending plan (queues tasks)
/start_execution — approve + run 24/7
/pause — pause 24/7 · /resume — resume
/reject <reason> — send the plan back to the CEO
/new <brief> — start a new unit of work
/cancel — cancel the active goal (stops execution)
/archive — archive the active goal (zips + parks it)
/kb <question> — ask the Knowledge Base
Or just message me to talk to the CEO.`;

/** Most-recently-created active goal — the implicit target for /cancel and /archive from the phone. */
async function latestActiveGoal(wsId: string): Promise<{ id: string; title: string } | null> {
  const [g] = await db.select({ id: goal.id, title: goal.title }).from(goal)
    .where(and(eq(goal.workspaceId, wsId), eq(goal.status, "active")))
    .orderBy(desc(goal.createdAt)).limit(1);
  return g ?? null;
}

/** Persist a control reply in the telegram channel (so it mirrors in-app) and send it to the phone. */
async function tgSay(ws: Ws, cfg: TgConfig, text: string): Promise<void> {
  const safe = scrubSecrets(text, [cfg.botToken]);
  await db.insert(message).values({ id: uid(), workspaceId: ws.id, channel: TG_CHANNEL, fromKind: "agent", fromHandle: "system", text: safe.slice(0, 4000) });
  await sendTelegramTo(cfg.botToken, cfg.chatId, safe);
  wake(ws.id);
}

/** Run a `/command` from Telegram as a real action. The operator turn is already persisted; we only
 *  add the reply. All actions are workspace-scoped to `ws` (already allowlist-checked in ingest). */
async function handleCommand(ws: Ws, cfg: TgConfig, raw: string): Promise<void> {
  awaitingReason.delete(ws.id); // any command supersedes a pending "send me the reject reason" wait
  const sp = raw.indexOf(" ");
  const cmd = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase();
  const rest = (sp === -1 ? "" : raw.slice(sp + 1)).trim();
  let reply = "";
  try {
    switch (cmd) {
      case "/help": reply = TG_HELP; break;
      case "/status": reply = await planStatusFor(ws); break;
      case "/review": reply = await reviewSummaryFor(ws); break;
      case "/tasks": reply = await tasksListFor(ws); break;
      case "/approve": { const r = await approvePlanFor(ws.orgId, ws); reply = `✅ Plan approved — ${r.made} task(s) queued. Send /start_execution to run 24/7.`; break; }
      case "/start_execution": case "/start": case "/run": {
        const r = await approvePlanFor(ws.orgId, ws); await setAuto247For(ws.id, true);
        reply = `▶️ Execution started — ${r.made} task(s) queued, 24/7 ON.`; break;
      }
      case "/pause": case "/stop": await setAuto247For(ws.id, false); reply = "⏸ 24/7 execution paused."; break;
      case "/resume": await setAuto247For(ws.id, true); reply = "▶️ 24/7 execution resumed."; break;
      case "/reject": await requestPlanChangesFor(ws.id, rest); reply = rest ? "↩️ Plan sent back to the CEO — reason recorded." : "↩️ Plan sent back to the CEO for revision."; break;
      case "/new": case "/new-work": case "/new-goal": {
        if (!rest) { reply = "Describe the work, e.g. `/new a billing page with checkout`."; break; }
        // Seed the brief as an operator turn, then let the CEO turn it into a goal + specs + issues.
        await db.insert(message).values({ id: uid(), workspaceId: ws.id, channel: TG_CHANNEL, fromKind: "operator", text: rest.slice(0, 4000) });
        wake(ws.id);
        await runCeoReply(ws, cfg);
        return; // the CEO already replied — no extra control message
      }
      case "/cancel": {
        const g = await latestActiveGoal(ws.id);
        if (!g) { reply = "No active goal to cancel."; break; }
        const r = await cancelGoalFor(ws.id, g.id);
        reply = r.ok ? `🛑 Cancelled — ${r.title}. Execution stopped; reopen in-app to resume.` : "Couldn't cancel the goal.";
        break;
      }
      case "/archive": {
        const g = await latestActiveGoal(ws.id);
        if (!g) { reply = "No active goal to archive."; break; }
        const r = await archiveGoalFor(ws.orgId, ws.id, g.id);
        reply = r.ok ? `📦 Archived — ${r.title}. Zipped to ${r.path}.` : "Couldn't archive the goal.";
        break;
      }
      case "/kb": case "/ask-kb": {
        if (!rest) { reply = "Ask a question, e.g. `/kb how does auth work?`"; break; }
        reply = (await kbAnswer(ws.orgId, rest)).text; break;
      }
      default: reply = `Unknown command ${cmd}.\n\n${TG_HELP}`;
    }
  } catch (e) { console.error("[telegram] command failed:", e); reply = "⚠️ Command failed — try again."; }
  if (reply) await tgSay(ws, cfg, reply);
}

/** Handle an inline-button tap (callback_query). Re-checks the allowlist, runs the action, ACKs the
 *  button, and strips the keyboard off one-shot actions so they can't be double-fired. */
async function handleCallback(ws: Ws, cfg: TgConfig, cb: TgCallbackQuery): Promise<void> {
  // ALLOWLIST — DEFAULT-DENY: a tap MUST carry a sender that matches the single registered chat/user. A real
  // callback_query always sets `from`; bail if it's missing or mismatched (a callback with neither `from` nor
  // `message` would otherwise skip both checks and run the action unverified). Also reject a mismatched chat.
  if (!cb.from || String(cb.from.id) !== String(cfg.chatId)) { await tgAnswerCallback(cfg.botToken, cb.id); return; }
  if (cb.message && String(cb.message.chat.id) !== String(cfg.chatId)) { await tgAnswerCallback(cfg.botToken, cb.id); return; }

  const data = (cb.data ?? "").trim();
  let toast = "", reply = "";
  try {
    switch (data) {
      case "approve_plan": { const r = await approvePlanFor(ws.orgId, ws); toast = "✅ Approved"; reply = `✅ Plan approved — ${r.made} task(s) queued. Send /start_execution to run 24/7.`; break; }
      case "start_exec": { const r = await approvePlanFor(ws.orgId, ws); await setAuto247For(ws.id, true); toast = "▶️ Executing"; reply = `▶️ Execution started — ${r.made} task(s) queued, 24/7 ON.`; break; }
      case "reject_plan": { await requestPlanChangesFor(ws.id); awaitingReason.add(ws.id); toast = "↩️ Sent back"; reply = "↩️ Plan sent back to the CEO. Reply with what to change and I'll record it as the reason."; break; }
      // Design remote control: approve auto-runs Send to execution (Design → Ada → plan); review = canvas→text; request changes routes to Grace.
      case "approve_design": { const r = await handoffToExecutionFor(ws.orgId, ws); toast = r.ok ? "✅ Approved" : "⚠️ Failed"; reply = r.ok ? "✅ Design approved & sent to execution — Grace is writing the full documentation, then Ada turns it into specs, issues & tasks automatically." : `⚠️ ${r.error || "Could not send to execution."}`; break; }
      case "review_design": { toast = "📝 Review"; reply = await designSummaryFor(ws.orgId, ws); break; }
      case "reject_design": { awaitingDesignReason.add(ws.id); toast = "↩️ Changes"; reply = "📝 What should change? Reply and I'll send it to Grace in the Design module."; break; }
      case "review": { toast = "📝 Review"; reply = await reviewSummaryFor(ws); break; }
      case "status": { toast = "📊 Status"; reply = await planStatusFor(ws); break; }
      case "pause": { await setAuto247For(ws.id, false); toast = "⏸ Paused"; reply = "⏸ 24/7 execution paused."; break; }
      case "resume": { await setAuto247For(ws.id, true); toast = "▶️ Resumed"; reply = "▶️ 24/7 execution resumed."; break; }
      default: toast = "Unknown action";
    }
  } catch (e) { console.error("[telegram] callback failed:", e); reply = "⚠️ Action failed — try again from the app."; }

  await tgAnswerCallback(cfg.botToken, cb.id, toast || undefined);
  // One-shot actions: strip the keyboard so a second tap can't re-fire them.
  if (cb.message && (data === "approve_plan" || data === "start_exec" || data === "reject_plan" || data === "approve_design")) {
    await tgClearButtons(cfg.botToken, cfg.chatId, cb.message.message_id);
  }
  if (reply) await tgSay(ws, cfg, reply);
}
