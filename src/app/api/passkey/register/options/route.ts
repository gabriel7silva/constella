import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passkey } from "@/db/schema";
import { getSession } from "@/lib/workspace";
import { rpID, RP_NAME, setChallenge } from "@/lib/passkey";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await db.select().from(passkey).where(eq(passkey.userId, session.user.id));
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: session.user.email,
    userDisplayName: session.user.name,
    userID: new TextEncoder().encode(session.user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports ? (p.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  await setChallenge("reg", options.challenge);
  return NextResponse.json(options);
}
