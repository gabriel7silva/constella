import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passkey } from "@/db/schema";
import { rpID, expectedOrigin, takeChallenge } from "@/lib/passkey";
import { createSessionCookie } from "@/server/passkey-login";

export async function POST(req: Request) {
  const body = (await req.json()) as { response: AuthenticationResponseJSON };
  const expectedChallenge = await takeChallenge("auth");
  if (!expectedChallenge) return NextResponse.json({ error: "challenge expired" }, { status: 400 });

  const [pk] = await db.select().from(passkey).where(eq(passkey.credentialId, body.response.id));
  if (!pk) return NextResponse.json({ error: "unknown credential" }, { status: 400 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      credential: {
        id: pk.credentialId,
        publicKey: new Uint8Array(Buffer.from(pk.publicKey, "base64url")),
        counter: pk.counter,
        transports: pk.transports ? (pk.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
      },
    });
  } catch (e) {
    // Log the REAL reason (origin/rpID/challenge mismatch, unknown credential, …) — the client only gets
    // a generic message, but a silent `catch {}` made this impossible to diagnose from the server.
    console.error("[passkey] authenticate verify failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  if (!verification.verified) return NextResponse.json({ error: "not verified" }, { status: 400 });

  // Clone/replay detection: a regressing signature counter means the credential was
  // copied. Only enforce when the authenticator actually uses a counter (stored > 0);
  // many platform authenticators report a constant 0, which is legitimate.
  const newCounter = verification.authenticationInfo.newCounter;
  if (pk.counter > 0 && newCounter <= pk.counter) {
    return NextResponse.json({ error: "credential counter regression (possible clone)" }, { status: 400 });
  }

  await db.update(passkey).set({ counter: newCounter }).where(eq(passkey.id, pk.id));

  const setCookie = await createSessionCookie(pk.userId);
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", setCookie);
  return res;
}
