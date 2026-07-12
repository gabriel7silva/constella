import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Same-origin by design. The auth client must call the host the dashboard was actually loaded from —
// `localhost` in local mode, a LAN IP, or the Tailscale IP on a VPS. A hardcoded/baked baseURL breaks
// every remote/VPS login: `NEXT_PUBLIC_*` is inlined at BUILD time, so a published package would always
// POST to `localhost:3000` on the *user's* device (→ ERR_CONNECTION_REFUSED). In the browser we use the
// live `window.location.origin`; on the server an explicit env can still override (else relative).
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, twoFactor } = authClient;
