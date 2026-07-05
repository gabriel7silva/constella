import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route protection (Next 16 `proxy` convention — was `middleware`):
 * Authentication is ALWAYS required — every launch (local, VPS, portable) redirects an unauthenticated
 * request to /login (which shows signup on first run, login afterwards). Only the auth routes themselves
 * are open. The deep workspace/org guard lives in `requireWorkspace()` (server-side).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public (no session) routes:
  // - /api/auth/*           — better-auth's own sign-in/sign-up endpoints.
  // - /api/passkey/authenticate/* — passkey LOGIN (options + verify); this runs while logged OUT, so it must
  //   be reachable without a session. (Passkey REGISTER stays protected — it's done while logged in, and
  //   /api/passkey/register/verify also re-checks the session — so an unauthenticated caller can't enroll a
  //   credential onto the operator account.)
  // - /api/health          — the browser polls it from every page (incl. /login) to detect a server restart
  //   and reload. Returns only a per-process boot id + version.
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/onboarding")
    || pathname.startsWith("/api/auth") || pathname.startsWith("/api/passkey/authenticate")
    || pathname.startsWith("/api/health");
  if (isAuthRoute) return NextResponse.next();

  const session = getSessionCookie(req);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
