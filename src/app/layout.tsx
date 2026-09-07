import type { Metadata } from "next";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPref } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Starfield } from "@/components/shell/starfield";
import { DeploymentSkewGuard } from "@/components/shell/deployment-skew-guard";
import { ServerReloadGuard } from "@/components/shell/server-reload-guard";
import { LangProvider } from "@/lib/i18n-context";
import { normalizeLang } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Constella — Agent OS",
  description: "Run autonomous AI agent teams as a company.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  // Light is the default theme; only an explicit "dark" cookie switches it.
  const theme = c.get("cn-theme")?.value === "dark" ? "theme-dark" : "theme-light";
  // Cookie is the fast path for anim-off; the DB pref is the durable source for signed-in users.
  const cookieAnimOff = c.get("cn-anim")?.value === "off";
  let dbReducedMotion = false;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const [pref] = await db.select({ reducedMotion: notificationPref.reducedMotion }).from(notificationPref).where(eq(notificationPref.userId, session.user.id));
      dbReducedMotion = pref?.reducedMotion ?? false;
    }
  } catch { /* unauthenticated or DB not ready — fall back to cookie */ }
  const animOff = cookieAnimOff || dbReducedMotion;
  const lang = normalizeLang(c.get("cn-lang")?.value);
  return (
    <html lang={lang === "pt" ? "pt-BR" : "en"} className={`${theme}${animOff ? " anim-off" : ""}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* suppressHydrationWarning on <body>: antivirus / browser extensions commonly inject attributes or
          nodes into <body> before React hydrates, which otherwise trips a hydration mismatch and the App
          Router "layout router" invariant. This tolerates that injection so the tree still hydrates. */}
      <body suppressHydrationWarning>
        <DeploymentSkewGuard />
        <ServerReloadGuard />
        <Starfield enabled={!animOff} />
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
