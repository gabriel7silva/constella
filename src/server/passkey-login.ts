import "server-only";
import { auth } from "@/lib/auth";

/**
 * Sign a value exactly like better-call's signed cookies (HMAC-SHA256 → base64,
 * `value.signature`, then URI-encoded) so better-auth accepts the cookie we mint
 * after a passkey assertion.
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return encodeURIComponent(`${value}.${b64}`);
}

/** Create a real better-auth session for `userId` and return the Set-Cookie header to apply. */
export async function createSessionCookie(userId: string): Promise<string> {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createSession(userId, false);
  const token = "token" in created ? created.token : (created as { session: { token: string } }).session.token;
  const cookie = ctx.authCookies.sessionToken;
  const secret = ctx.secret as string;
  const value = await signCookieValue(token, secret);
  const maxAge = ctx.sessionConfig.expiresIn;
  const secure = cookie.attributes.secure ? "; Secure" : "";
  return `${cookie.name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}
