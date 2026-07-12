import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpID, setChallenge } from "@/lib/passkey";

/**
 * Discoverable-credential (resident-key) flow: we deliberately do NOT look the
 * email up or return allowCredentials. The response shape is identical whether or
 * not the email is registered, so this endpoint can't be used to enumerate which
 * accounts exist / have passkeys. The authenticator selects its own credential.
 */
export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
  });

  await setChallenge("auth", options.challenge);
  return NextResponse.json(options);
}
