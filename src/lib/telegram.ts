import "server-only";
import { getSecret } from "@/lib/vault";

/** Telegram bot tokens are `<numeric-id>:<35-char base64url-ish>`. */
export function isTelegramToken(t: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(t);
}

/**
 * Real Telegram delivery via the Bot API. The bot token + chat id are stored
 * (encrypted) in the vault under `telegram_bot` as {botToken, chatId} — set from
 * the Profile screen. If Telegram isn't configured this is an honest no-op
 * (skipped:true), never a fabricated "sent".
 */
export async function sendTelegram(workspaceId: string, text: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const raw = await getSecret(workspaceId, "telegram_bot");
  if (!raw) return { ok: false, skipped: true };
  let botToken = "", chatId = "";
  try { ({ botToken, chatId } = JSON.parse(raw)); } catch { return { ok: false, error: "bad telegram secret" }; }
  if (!botToken || !chatId) return { ok: false, skipped: true };
  // The token lands in the request URL — a malformed value (path/CRLF/query chars)
  // could repoint the request. Enforce the real Telegram token shape before use.
  if (!isTelegramToken(botToken)) return { ok: false, error: "invalid telegram token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Cap length: notification bodies can mirror agent/tool output — bound the
      // outbound egress instead of forwarding arbitrarily large content.
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500), parse_mode: "Markdown", disable_web_page_preview: true }),
    });
    if (!res.ok) return { ok: false, error: `telegram http ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/* ----------------------------------------------------------- bidirectional bot */
const TG = "https://api.telegram.org";

export type TgConfig = { botToken: string; chatId: string; allowedName?: string };
export type TgCallbackQuery = {
  id: string;
  from?: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
};
export type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string; caption?: string;
    photo?: { file_id: string }[];
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
  callback_query?: TgCallbackQuery;
};

/** The vaulted Telegram config (bot token + the ONE allowed chat id + the registered name). */
export async function getTelegramConfig(workspaceId: string): Promise<TgConfig | null> {
  const raw = await getSecret(workspaceId, "telegram_bot");
  if (!raw) return null;
  try { const c = JSON.parse(raw) as TgConfig; if (c.botToken && c.chatId && isTelegramToken(c.botToken)) return c; } catch { /* bad */ }
  return null;
}

/** Verify a bot token → its @username (used at registration time). */
export async function tgGetMe(token: string): Promise<{ ok: boolean; username?: string }> {
  if (!isTelegramToken(token)) return { ok: false };
  try { const r = await fetch(`${TG}/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) }); const j = await r.json(); return { ok: !!j.ok, username: j.result?.username }; }
  catch { return { ok: false }; }
}

/** The remote-control commands shown in Telegram's "/" menu. MUST match `handleCommand` in
 *  src/server/telegram.ts. Registered via `setMyCommands` at connect time. */
export const TG_BOT_COMMANDS: { command: string; description: string }[] = [
  { command: "help", description: "Show the remote-control commands" },
  { command: "status", description: "Quick project status" },
  { command: "review", description: "Plan / issues / tasks summary" },
  { command: "tasks", description: "What's in flight right now" },
  { command: "approve", description: "Approve the pending plan" },
  { command: "start_execution", description: "Approve + run 24/7" },
  { command: "pause", description: "Pause 24/7 execution" },
  { command: "resume", description: "Resume 24/7 execution" },
  { command: "reject", description: "Send the plan back to the CEO" },
  { command: "new", description: "Start new work — describe it" },
  { command: "cancel", description: "Cancel the active goal" },
  { command: "archive", description: "Archive the active goal" },
  { command: "kb", description: "Ask the Knowledge Base" },
];

/** Register the bot's "/" command menu (so Telegram shows the command list). Best-effort. */
export async function tgSetMyCommands(token: string, commands = TG_BOT_COMMANDS): Promise<boolean> {
  if (!isTelegramToken(token)) return false;
  try {
    const r = await fetch(`${TG}/bot${token}/setMyCommands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commands }), signal: AbortSignal.timeout(8000) });
    const j = await r.json(); return !!j.ok;
  } catch { return false; }
}

/** Long-poll new updates since `offset` (25s server-side wait). `message` + inline-button taps
 *  (`callback_query`) — the remote-control buttons in P4 need the latter. */
export async function tgGetUpdates(token: string, offset: number): Promise<TgUpdate[]> {
  if (!isTelegramToken(token)) return [];
  try {
    const r = await fetch(`${TG}/bot${token}/getUpdates?offset=${offset}&timeout=25&allowed_updates=${encodeURIComponent('["message","callback_query"]')}`, { signal: AbortSignal.timeout(30_000) });
    const j = await r.json();
    return j.ok ? (j.result as TgUpdate[]) : [];
  } catch { return []; }
}

/** Download a Telegram file (photo/document) → bytes + extension. */
export async function tgGetFile(token: string, fileId: string): Promise<{ buf: Buffer; ext: string } | null> {
  if (!isTelegramToken(token)) return null;
  try {
    const r = await fetch(`${TG}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    const fp: string | undefined = j.result?.file_path;
    if (!fp) return null;
    const f = await fetch(`${TG}/file/bot${token}/${fp}`, { signal: AbortSignal.timeout(30_000) });
    if (!f.ok) return null;
    return { buf: Buffer.from(await f.arrayBuffer()), ext: (fp.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase() };
  } catch { return null; }
}

/** Show the "typing…" indicator in a chat. Telegram clears it after ~5s, so the caller re-sends it
 *  on a heartbeat while the agent is generating a (possibly slow) reply. Best-effort. */
export async function tgSendChatAction(token: string, chatId: string, action = "typing"): Promise<void> {
  if (!isTelegramToken(token)) return;
  try {
    await fetch(`${TG}/bot${token}/sendChatAction`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* best-effort */ }
}

/** Send a plain-text reply to a specific chat (agent replies — no Markdown so content can't break). */
export async function sendTelegramTo(token: string, chatId: string, text: string): Promise<boolean> {
  if (!isTelegramToken(token)) return false;
  try {
    const r = await fetch(`${TG}/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3800), disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

/* ----------------------------------------------------------- inline keyboards (remote control) */

export type TgButton = { text: string; data: string };

/** Send a plain-text message carrying an inline keyboard (rows of callback buttons). No Markdown —
 *  arbitrary content (issue titles, workspace names) must never break the send or eat a button. */
export async function sendTelegramButtons(token: string, chatId: string, text: string, rows: TgButton[][]): Promise<{ ok: boolean; messageId?: number }> {
  if (!isTelegramToken(token)) return { ok: false };
  try {
    const r = await fetch(`${TG}/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text: text.slice(0, 3500), disable_web_page_preview: true,
        // callback_data is hard-capped at 64 bytes by Telegram — our ids are short ASCII tokens.
        reply_markup: { inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data.slice(0, 64) }))) },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return { ok: false };
    const j = await r.json().catch(() => ({}));
    return { ok: !!j.ok, messageId: j.result?.message_id };
  } catch { return { ok: false }; }
}

/** Acknowledge a button tap — clears its loading spinner; optional short toast on the phone. */
export async function tgAnswerCallback(token: string, callbackId: string, text?: string): Promise<void> {
  if (!isTelegramToken(token)) return;
  try {
    await fetch(`${TG}/bot${token}/answerCallbackQuery`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, ...(text ? { text: text.slice(0, 200) } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* best-effort */ }
}

/** Strip the inline keyboard off a sent message — so a one-shot action (approve/reject) can't be
 *  re-fired by tapping the same button twice. Best-effort. */
export async function tgClearButtons(token: string, chatId: string, messageId: number): Promise<void> {
  if (!isTelegramToken(token)) return;
  try {
    await fetch(`${TG}/bot${token}/editMessageReplyMarkup`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* best-effort */ }
}
