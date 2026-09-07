"use server";

import { randomUUID as uid, randomBytes, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user, account, notificationPref, personalAccessToken, passkey } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession, requireWorkspace } from "@/lib/workspace";
import { deleteWorkspacePath } from "@/lib/fs-workspace";
import { putSecret } from "@/lib/vault";
import { isTelegramToken, tgGetMe, getTelegramConfig, tgSetMyCommands } from "@/lib/telegram";

async function uid_or_redirect() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user.id;
}

/* ---- Account ---- */
export async function updateProfile(input: { name?: string; addressAs?: string; lang?: string; tz?: string; image?: string | null }) {
  const userId = await uid_or_redirect();
  const patch: Record<string, string | null> = {};
  if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim();
  if (typeof input.addressAs === "string") patch.addressAs = input.addressAs;
  if (typeof input.lang === "string") patch.lang = input.lang;
  if (typeof input.tz === "string") patch.tz = input.tz;
  if (input.image !== undefined) {
    patch.image = input.image; // DB-stored data URL (or null to clear)
    // Clean up a LEGACY workspace-stored avatar when it's replaced/removed.
    try {
      const [u] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
      if (u?.image && u.image.startsWith("uploads/") && u.image !== input.image) {
        const { org } = await requireWorkspace();
        deleteWorkspacePath(org.id, u.image.split("/").slice(0, 2).join("/"));
      }
    } catch { /* best-effort */ }
  }
  if (Object.keys(patch).length) await db.update(user).set(patch).where(eq(user.id, userId));
  revalidatePath("/profile");
  revalidatePath("/", "layout");
}

/* ---- Notifications ---- */
export async function setNotifPref(key: "email" | "telegram" | "inapp" | "weekly", value: boolean) {
  const userId = await uid_or_redirect();
  await db.insert(notificationPref).values({ userId, [key]: value }).onConflictDoUpdate({ target: notificationPref.userId, set: { [key]: value } });
  revalidatePath("/profile");
}

/** Persist the operator's reduce-motion preference in the DB and sync the cn-anim cookie so the
 *  change takes effect immediately without a full sign-out / sign-in cycle. */
export async function setMotionPref(reduce: boolean) {
  const userId = await uid_or_redirect();
  await db.insert(notificationPref).values({ userId, reducedMotion: reduce }).onConflictDoUpdate({ target: notificationPref.userId, set: { reducedMotion: reduce } });
  // Keep the cookie in sync so layout.tsx can apply anim-off on the very next render,
  // and the AnimToggle component reads the correct value from document.cookie.
  const c = await cookies();
  c.set("cn-anim", reduce ? "off" : "on", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/profile");
  revalidatePath("/", "layout");
}

/* ---- Personal access tokens (real, hashed at rest) ---- */
// DISABLED for now — personal access tokens are hidden in the Profile UI and deactivated here too
// (not for public yet). Any call fails loudly. The original implementation is kept verbatim below so
// re-enabling is just: delete the throw + uncomment the body, and restore the "tokens" tab in
// components/modules/profile.tsx.
export async function createPAT(_name: string, _scope: string): Promise<{ token: string }> {
  throw new Error("Personal access tokens are disabled.");
  // const userId = await uid_or_redirect();
  // const raw = "cn_" + randomBytes(24).toString("base64url");
  // const tokenHash = createHash("sha256").update(raw).digest("hex");
  // await db.insert(personalAccessToken).values({
  //   id: uid(), userId, name: _name.trim() || "Token", scope: _scope || "read",
  //   tokenHash, prefix: raw.slice(0, 7),
  // });
  // revalidatePath("/profile");
  // return { token: raw };
}

export async function revokePAT(id: string) {
  const userId = await uid_or_redirect();
  await db.delete(personalAccessToken).where(and(eq(personalAccessToken.id, id), eq(personalAccessToken.userId, userId)));
  revalidatePath("/profile");
}

/* ---- Sessions ---- */
export async function revokeSessionAction(token: string) {
  await auth.api.revokeSession({ body: { token }, headers: await headers() });
  revalidatePath("/profile");
}

export async function revokeOtherSessionsAction() {
  await auth.api.revokeOtherSessions({ headers: await headers() });
  revalidatePath("/profile");
}

/* ---- Connections ---- */
export async function unlinkSocial(providerId: string) {
  const userId = await uid_or_redirect();
  // remove the linked OAuth account row for this provider
  await db.delete(account).where(and(eq(account.userId, userId), eq(account.providerId, providerId)));
  revalidatePath("/profile");
}

export async function connectTelegram(botToken: string, chatId: string, allowedName?: string): Promise<{ ok: boolean; error?: string; username?: string }> {
  const { workspace } = await requireWorkspace();
  const token = botToken.trim(), chat = chatId.trim();
  // Validate the token shape at write-time so a malformed value never reaches the
  // request URL in sendTelegram (and the operator gets immediate feedback).
  if (!isTelegramToken(token)) return { ok: false, error: "Invalid bot token format" };
  // Positive id only → a PRIVATE chat (where chat.id === your user id). Group/channel ids are
  // negative and would let every group member drive the bot — reject them.
  if (!/^\d{1,20}$/.test(chat)) return { ok: false, error: "Chat id must be your personal numeric id (a private chat — not a group)." };
  // Verify the token actually works against the Bot API before storing it.
  const me = await tgGetMe(token);
  if (!me.ok) return { ok: false, error: "Telegram rejected this bot token." };
  // `chatId` is the ONLY chat the bot will talk to (allowlist); `allowedName` is shown for clarity.
  await putSecret(workspace.id, "telegram_bot", JSON.stringify({ botToken: token, chatId: chat, allowedName: (allowedName ?? "").trim().slice(0, 80) }));
  // Register the bot's "/" command menu so Telegram shows the remote-control command list (best-effort).
  void tgSetMyCommands(token).catch(() => {});
  revalidatePath("/profile");
  return { ok: true, username: me.username };
}

/** Connection status for the in-app Telegram tab/card (no network call — reads the vaulted config).
 *  chatId is masked so the dock never renders the raw allowed id. */
export async function telegramStatus(): Promise<{ connected: boolean; allowedName?: string; chatIdMasked?: string }> {
  const { workspace } = await requireWorkspace();
  const cfg = await getTelegramConfig(workspace.id);
  if (!cfg) return { connected: false };
  const id = cfg.chatId;
  const masked = id.length > 4 ? id.slice(0, 2) + "•••" + id.slice(-2) : "•••";
  return { connected: true, allowedName: cfg.allowedName, chatIdMasked: masked };
}

export async function disconnectTelegram() {
  const { workspace } = await requireWorkspace();
  const { db: rawDb } = await import("@/db");
  const { vault } = await import("@/db/schema");
  await rawDb.delete(vault).where(and(eq(vault.workspaceId, workspace.id), eq(vault.ref, "telegram_bot")));
  revalidatePath("/profile");
}

/* ---- Passkeys (management; registration/auth happen via /api/passkey routes) ---- */
export async function removePasskey(id: string) {
  const userId = await uid_or_redirect();
  await db.delete(passkey).where(and(eq(passkey.id, id), eq(passkey.userId, userId)));
  revalidatePath("/profile");
}

export async function renamePasskey(id: string, name: string) {
  const userId = await uid_or_redirect();
  await db.update(passkey).set({ name: name.trim() || "Passkey" }).where(and(eq(passkey.id, id), eq(passkey.userId, userId)));
  revalidatePath("/profile");
}

/* ---- Danger zone ---- */
export async function deleteAccountAction() {
  const userId = await uid_or_redirect();
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  await db.delete(user).where(eq(user.id, userId)); // cascades sessions/accounts/passkeys/tokens
  redirect("/login");
}
