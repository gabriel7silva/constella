import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { account, notificationPref, personalAccessToken, passkey, vault, user } from "@/db/schema";
import { auth, SOCIAL_PROVIDERS } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { ViewShell } from "@/components/shell/view-shell";
import { Profile, ProfileSaveButton } from "@/components/modules/profile";
import { getT } from "@/lib/i18n-server";

export default async function ProfilePage() {
  const t = await getT();
  const { session, workspace } = await requireWorkspace();
  const userId = session.user.id;
  const h = await headers();

  const sessions = await auth.api.listSessions({ headers: h }).catch(() => []);
  const tokens = await db.select().from(personalAccessToken).where(eq(personalAccessToken.userId, userId));
  const passkeys = await db.select().from(passkey).where(eq(passkey.userId, userId));
  const accounts = await db.select().from(account).where(eq(account.userId, userId));
  const [prefRow] = await db.select().from(notificationPref).where(eq(notificationPref.userId, userId));
  const [tg] = await db.select().from(vault).where(and(eq(vault.workspaceId, workspace.id), eq(vault.ref, "telegram_bot")));

  // Read the real persisted user row — better-auth's session.user does not surface
  // our custom columns (addressAs/lang/tz), so the form must read them from the DB.
  const [urow] = await db.select().from(user).where(eq(user.id, userId));

  return (
    <ViewShell title={t("profile.title")} sub={t("profile.sub")} right={<ProfileSaveButton />}>
      <Profile
        account={{ name: urow?.name ?? session.user.name, email: urow?.email ?? session.user.email, addressAs: urow?.addressAs ?? "", lang: urow?.lang ?? "English (US)", tz: urow?.tz ?? "UTC", twoFactorEnabled: !!urow?.twoFactorEnabled, image: urow?.image ?? null }}
        sessions={sessions.map((s) => ({ id: s.id, token: s.token, device: s.userAgent ?? "Unknown device", ip: s.ipAddress ?? "", current: s.token === session.session.token, createdAt: Math.floor(Number(s.createdAt) / 1000) }))}
        tokens={tokens.map((t) => ({ id: t.id, name: t.name, scope: t.scope, prefix: t.prefix, lastUsed: t.lastUsedAt ? Math.floor(Number(t.lastUsedAt) / 1000) : null }))}
        passkeys={passkeys.map((p) => ({ id: p.id, name: p.name, backedUp: p.backedUp, createdAt: Math.floor(Number(p.createdAt) / 1000) }))}
        connections={{
          providers: SOCIAL_PROVIDERS,
          linked: accounts.map((a) => a.providerId),
          telegram: !!tg,
        }}
        prefs={{ email: prefRow?.email ?? true, telegram: prefRow?.telegram ?? true, inapp: prefRow?.inapp ?? true, weekly: prefRow?.weekly ?? false, reducedMotion: prefRow?.reducedMotion ?? false }}
      />
    </ViewShell>
  );
}
