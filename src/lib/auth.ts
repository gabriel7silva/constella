import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

function firstHeaderValue(value: string | null | undefined): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function originFromURL(value: string | null | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function originFromRequestHost(request: Request | undefined): string | null {
  const headers = request?.headers;
  const host = firstHeaderValue(headers?.get("x-forwarded-host")) ?? firstHeaderValue(headers?.get("host"));
  if (!host) return null;
  const proto = (firstHeaderValue(headers?.get("x-forwarded-proto")) ?? (BASE_URL.startsWith("https://") ? "https" : "http")).replace(/:$/, "");
  if (!/^[a-z][a-z0-9+.-]*$/i.test(proto)) return null;
  return originFromURL(`${proto}://${host}`);
}

function addOrigin(out: Set<string>, value: string | null | undefined): void {
  const origin = originFromURL(value?.trim());
  if (origin) out.add(origin);
}

const CONFIGURED_TRUSTED_ORIGINS = (() => {
  const out = new Set<string>();
  for (const value of [
    BASE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ...(process.env.CONSTELLA_TRUSTED_ORIGINS ?? "").split(","),
  ]) addOrigin(out, value);
  return [...out];
})();

function trustedOriginsForRequest(request?: Request): string[] {
  const out = new Set(CONFIGURED_TRUSTED_ORIGINS);
  addOrigin(out, request?.url);
  const hostOrigin = originFromRequestHost(request);
  if (hostOrigin) out.add(hostOrigin);
  return [...out];
}

/**
 * Every deployment signs sessions with a real secret (auth is always required). The launcher persists a
 * BETTER_AUTH_SECRET under the runtime root for every launch, so this should always be present; without it
 * session tokens would be forgeable.
 *
 * This is intentionally NOT a throw at import time: `auth` is pulled into the (app) layout's
 * import graph (via requireWorkspace → ChatDock), so throwing here would crash EVERY page —
 * even ones that don't touch auth — with no error boundary able to help. Instead we warn at
 * import and let `assertAuthSecret()` (called once at boot) hard-fail loudly with context.
 */
const AUTH_SECRET_OK = !!process.env.BETTER_AUTH_SECRET;
if (!AUTH_SECRET_OK) {
  console.error("[auth] FATAL: BETTER_AUTH_SECRET is required (sessions would be forgeable). Set it in your environment.");
}

/** Hard gate for boot/startup: without a real signing secret, refuse to run. */
export function assertAuthSecret(): void {
  if (!AUTH_SECRET_OK) {
    throw new Error("BETTER_AUTH_SECRET is required (sessions would be forgeable).");
  }
}

/** Social providers are only registered when their env credentials are present. */
const socialProviders: Record<string, { clientId: string; clientSecret: string; scope?: string[] }> = {};
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  // `repo` scope so an OAuth login can also commit/push (not just sign in). The access token is
  // stored on the `account` row and used by src/server/github.ts when no PAT is set.
  socialProviders.github = { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, scope: ["repo", "read:user"] };
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
}

/** Which OAuth providers are actually configured — drives the Connections UI. */
export const SOCIAL_PROVIDERS = Object.keys(socialProviders);

/**
 * better-auth server config.
 * - Email/password is always available (required for auth / vps / portable modes).
 * - In `start` mode the app auto-creates and auto-signs-in a local operator,
 *   so the login screen is skipped (handled in middleware / bootstrap).
 * - twoFactor plugin powers real TOTP 2FA (Profile → Security).
 * - Social providers (GitHub/Google) enable real account linking (Profile → Connections).
 */
export const auth = betterAuth({
  baseURL: BASE_URL,
  // Trust configured origins plus the origin implied by the request Host header. In Next production,
  // request.url can be loopback/internal even when the browser is on a Tailscale/LAN URL, so Host keeps
  // Better Auth's CSRF check aligned with the visible address without trusting arbitrary Origin headers.
  trustedOrigins: trustedOriginsForRequest,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  socialProviders,
  account: {
    accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    additionalFields: {
      activeOrgId: { type: "string", required: false },
    },
  },
  // nextCookies() MUST be last — lets server-side auth.api.* calls set cookies
  // (so signup auto-signs-in right after creating the account).
  // twoFactor() DISABLED — 2FA is hidden from the Profile UI and deactivated here too (not for public yet).
  // Re-enable: add twoFactor() back to this array + restore the 2FA block in components/modules/profile.tsx.
  plugins: [/* twoFactor(), */ nextCookies()],
  advanced: {
    // Mark session cookies Secure whenever the app is served over https — not just
    // in `vps` mode. `auth`/`portable` can sit behind an https reverse proxy or
    // Tailscale, where a non-Secure cookie is capturable on a downgraded hop.
    // `start` is local http only, so it stays relaxed.
    useSecureCookies: BASE_URL.startsWith("https://"),
  },
});

export type Session = typeof auth.$Infer.Session;
