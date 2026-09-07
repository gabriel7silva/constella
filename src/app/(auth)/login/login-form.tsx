"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { signIn, authClient } from "@/lib/auth-client";
import { signupAction } from "@/server/auth-actions";
import { ConstellaMark } from "@/components/ui/constella-mark";
import { Icon } from "@/components/ui/icon";
import { AnimToggle } from "@/components/shell/anim-toggle";
import { LangSwitch } from "@/components/shell/lang-switch";
import { useT } from "@/lib/i18n-context";

type Screen = "signin" | "signup";

/** Authentication is always required. The first run (no operator password yet) shows a SIGNUP screen that
 *  creates the single operator account; every run afterwards shows LOGIN. There is no "sign up" fallback on
 *  the login screen and no run-mode picker — a wrong password or a re-login can never create an account. */
export function LoginForm({ screen: initialScreen, operatorEmail }: { screen: Screen; operatorEmail: string }) {
  const router = useRouter();
  const t = useT();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [email, setEmail] = useState(operatorEmail);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [twofa, setTwofa] = useState(false);
  const [code, setCode] = useState("");

  /** Route on a successful sign-in, honoring a 2FA redirect. */
  function finishSignIn(data: unknown) {
    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) { setTwofa(true); return; }
    router.push("/");
  }

  async function submitSignIn() {
    setBusy(true); setErr("");
    const res = await signIn.email({ email, password });
    if (res.error) { setBusy(false); setErr(t("login.invalidCredentials")); return; }
    finishSignIn(res.data); setBusy(false);
  }

  async function submitSignup() {
    setErr("");
    if (password !== confirm) { setErr(t("login.passwordMismatch")); return; }
    setBusy(true);
    const res = await signupAction({ email, name, password });
    if (!res.ok) {
      setBusy(false);
      if (res.error === "alreadyConfigured") { setScreen("signin"); setPassword(""); setConfirm(""); setNote(t("login.alreadyConfigured")); return; }
      setErr(t("login.failed"));
      return;
    }
    // Account created — sign in normally.
    const signed = await signIn.email({ email: res.email, password });
    if (signed.error) { setBusy(false); setErr(t("login.failed")); return; }
    finishSignIn(signed.data); setBusy(false);
  }

  async function verify2fa() {
    setBusy(true); setErr("");
    const res = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (res.error) { setErr(res.error.message ?? t("login.invalidCode")); return; }
    router.push("/");
  }

  async function passkeyLogin() {
    setBusy(true); setErr("");
    try {
      const opts = await fetch("/api/passkey/authenticate/options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).then((r) => r.json());
      if (opts.error) throw new Error(opts.error);
      const asr = await startAuthentication({ optionsJSON: opts });
      const res = await fetch("/api/passkey/authenticate/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response: asr }) }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error ?? t("login.passkeyFailed"));
      router.push("/");
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : t("login.passkeyFailed"));
    }
  }

  const title = screen === "signup" ? t("login.signup.title") : t("login.title");
  const sub = screen === "signup" ? t("login.signup.sub") : t("login.sub.continue");

  return (
    <div className="login-wrap">
      <div className="login-aurora" aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", background: "radial-gradient(60% 50% at 70% 20%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%), radial-gradient(50% 40% at 20% 80%, color-mix(in srgb, #7c5cff 16%, transparent), transparent 70%)" }} />
      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <ConstellaMark size={46} rx={13} /><span style={{ fontSize: 18, fontWeight: 800 }}>Constella</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}><LangSwitch /><AnimToggle /></div>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{title}</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{sub}</p>

        {note && <p style={{ color: "var(--accent)", fontSize: 12.5, marginBottom: 10 }}>{note}</p>}

        {twofa ? (
          <>
            <label className="form-label">{t("login.authCode")}</label>
            <input className="form-input" placeholder="123456" autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 6) verify2fa(); }} />
            {err && <p style={{ color: "var(--sx-keyword)", fontSize: 12.5, marginTop: 8 }}>{err}</p>}
            <button className="btn-accent" style={{ width: "100%", justifyContent: "center", marginTop: 16, padding: 11 }}
                    disabled={busy || code.length < 6} onClick={verify2fa}>{busy ? t("login.verifying") : t("login.verify")}</button>
          </>
        ) : screen === "signup" ? (
          <>
            <label className="form-label">{t("login.name")}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Operator" />
            <label className="form-label">{t("login.email")}</label>
            <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="form-label">{t("login.password")}</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <label className="form-label">{t("login.confirmPassword")}</label>
            <input className="form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••"
                   onKeyDown={(e) => { if (e.key === "Enter" && password.length >= 8 && confirm.length >= 8) submitSignup(); }} />
            {err && <p style={{ color: "var(--sx-keyword)", fontSize: 12.5, marginTop: 8 }}>{err}</p>}
            <button className="btn-accent" style={{ width: "100%", justifyContent: "center", marginTop: 12, padding: 11 }}
                    disabled={busy || password.length < 8 || confirm.length < 8} onClick={submitSignup}>
              {busy ? t("login.signingIn") : t("login.signup.button")}
            </button>
          </>
        ) : (
          <>
            <label className="form-label">{t("login.email")}</label>
            <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="form-label">{t("login.password")}</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && password.length >= 8) submitSignIn(); }} />
            {err && <p style={{ color: "var(--sx-keyword)", fontSize: 12.5, marginTop: 8 }}>{err}</p>}
            <button className="btn-accent" style={{ width: "100%", justifyContent: "center", marginTop: 12, padding: 11 }}
                    disabled={busy || password.length < 8} onClick={submitSignIn}>
              {busy ? t("login.signingIn") : t("login.signin")}
            </button>
            <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: 10 }}
                    disabled={busy} onClick={passkeyLogin} type="button">{t("login.passkey")}</button>
          </>
        )}
        <div className="login-note" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 11.5, color: "var(--text-faint)" }}>
          <Icon name="shield" size={13} /> {t("login.note")}
        </div>
      </div>
    </div>
  );
}
