import { NextResponse } from "next/server";
import { randomUUID as uid } from "node:crypto";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/db";
import { passkey } from "@/db/schema";
import { getSession } from "@/lib/workspace";
import { rpID, expectedOrigin, takeChallenge } from "@/lib/passkey";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { response: RegistrationResponseJSON; name?: string };
  const expectedChallenge = await takeChallenge("reg");
  if (!expectedChallenge) return NextResponse.json({ error: "challenge expired" }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
    });
  } catch (e) {
    // Log the REAL reason (origin/rpID/challenge mismatch, malformed attestation, …) — the client only
    // gets a generic message, but a silent `catch {}` made this impossible to diagnose from the server.
    console.error("[passkey] register verify failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "not verified" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await db.insert(passkey).values({
    id: uid(),
    userId: session.user.id,
    name: (body.name || "Passkey").trim(),
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    deviceType: credentialDeviceType ?? "",
    backedUp: credentialBackedUp ?? false,
    transports: (credential.transports ?? []).join(","),
  });

  return NextResponse.json({ ok: true });
}
