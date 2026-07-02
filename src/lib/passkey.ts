import { cookies } from "next/headers";

/**
 * WebAuthn config + challenge persistence for the real passkey flow
 * (Profile → Security). The relying-party id is the bare hostname; the
 * expected origin is the full base URL. Challenges live in short-lived
 * httpOnly cookies between the "options" and "verify" round-trips.
 */
export function baseURL(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function rpID(): string {
  return new URL(baseURL()).hostname;
}

export const RP_NAME = "Constella";

export function expectedOrigin(): string {
  return new URL(baseURL()).origin;
}

const REG_CHALLENGE = "pk_reg_chal";
const AUTH_CHALLENGE = "pk_auth_chal";

export async function setChallenge(kind: "reg" | "auth", value: string) {
  const jar = await cookies();
  jar.set(kind === "reg" ? REG_CHALLENGE : AUTH_CHALLENGE, value, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 300,
    secure: baseURL().startsWith("https"),
  });
}

export async function takeChallenge(kind: "reg" | "auth"): Promise<string | null> {
  const jar = await cookies();
  const name = kind === "reg" ? REG_CHALLENGE : AUTH_CHALLENGE;
  const v = jar.get(name)?.value ?? null;
  if (v) jar.delete(name);
  return v;
}
