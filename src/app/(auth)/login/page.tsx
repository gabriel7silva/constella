import { OPERATOR_DEFAULT, getOperator, operatorPasswordSet, operatorCredentialExists } from "@/server/operator-credential";
import { LoginForm } from "./login-form";

// The screen depends on the live operator state (the `.env` password-set flag + the DB), which changes at
// runtime when the operator signs up — never prerender it, or a build-time snapshot ("signup") would be
// baked in and served forever.
export const dynamic = "force-dynamic";

/** Auth is always required. First run (no operator password yet) → a real SIGNUP screen; afterwards → LOGIN. */
export default async function LoginPage() {
  const operator = await getOperator();
  // DB is the source of truth for "a password exists" — show LOGIN whenever a credential exists, even if the
  // `.env` flag de-synced (restored DB / regenerated `.env`), so signup can't be used to reset the password.
  const hasPassword = operatorPasswordSet() || (await operatorCredentialExists());
  return (
    <LoginForm
      screen={hasPassword ? "signin" : "signup"}
      operatorEmail={operator?.email ?? OPERATOR_DEFAULT.email}
    />
  );
}
