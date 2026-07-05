"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { authClient } from "@/lib/auth-client";
import { Icon, type IconName } from "@/components/ui/icon";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { LangSwitch } from "@/components/shell/lang-switch";
import { useT } from "@/lib/i18n-context";
import {
  updateProfile, setNotifPref, setMotionPref, createPAT, revokePAT, revokeSessionAction, revokeOtherSessionsAction,
  unlinkSocial, connectTelegram, disconnectTelegram, removePasskey, deleteAccountAction,
} from "@/server/actions/profile-actions";

type Account = { name: string; email: string; addressAs: string; lang: string; tz: string; twoFactorEnabled: boolean; image?: string | null };
type SessionRow = { id: string; token: string; device: string; ip: string; current: boolean; createdAt: number };
type TokenRow = { id: string; name: string; scope: string; prefix: string; lastUsed: number | null };
type PasskeyRow = { id: string; name: string; backedUp: boolean; createdAt: number };
type Props = {
  account: Account;
  sessions: SessionRow[];
  tokens: TokenRow[];
  passkeys: PasskeyRow[];
  connections: { providers: string[]; linked: string[]; telegram: boolean };
  prefs: { email: boolean; telegram: boolean; inapp: boolean; weekly: boolean; reducedMotion: boolean };
};

// Bridge so the mock's global header "Save changes" button can drive the Account form save.
const SAVE_EVENT = "constella:profile-save";

const TABS: { id: string; icon: IconName }[] = [
  { id: "account", icon: "account" },
  { id: "security", icon: "shield" },
  // Personal access tokens — HIDDEN from the UI for now (not for public yet). The TokensTab component
  // and its render below stay in code (deactivated); the createPAT server action is disabled server-side.
  // Re-enable by uncommenting this tab + restoring createPAT in server/actions/profile-actions.ts.
  // { id: "tokens", icon: "skill" },
  { id: "connections", icon: "git" },
  { id: "notifications", icon: "bell" },
  { id: "sessions", icon: "cpu" },
];

export function Profile(props: Props) {
  const t = useT();
  const [tab, setTab] = useState<string>("account");
  // The header "Save changes" button (ProfileSaveButton) only flips to "✓ Saved" when a tab answers
  // SAVE_EVENT with SAVE_EVENT:done. The Account tab does that after it persists; every other tab
  // auto-saves inline on each change, so there's nothing to persist on click — confirm immediately so the
  // button gives feedback on ALL tabs (it was a silent no-op on Notifications/Connections/Sessions before).
  useEffect(() => {
    function onSave() { if (tab !== "account") window.dispatchEvent(new CustomEvent(SAVE_EVENT + ":done")); }
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
  }, [tab]);
  return (
    <div className="settings">
      <div className="settings-nav">
        {TABS.map((tb) => (
          <button key={tb.id} className={"sn-item" + (tab === tb.id ? " on" : "")} onClick={() => setTab(tb.id)}>
            <Icon name={tb.icon} size={15} /> {t(`profile.tab.${tb.id}`)}
          </button>
        ))}
      </div>

      <div className="settings-panel">
        {tab === "account" && <AccountTab account={props.account} />}
        {tab === "security" && <SecurityTab account={props.account} passkeys={props.passkeys} />}
        {tab === "tokens" && <TokensTab tokens={props.tokens} />}
        {tab === "connections" && <ConnectionsTab connections={props.connections} />}
        {tab === "notifications" && <NotificationsTab prefs={props.prefs} />}
        {tab === "sessions" && <SessionsTab sessions={props.sessions} />}
      </div>
    </div>
  );
}

/* Header "Save changes" button rendered in the ViewShell `right` slot by the server page.
   Dispatches the save event; the Account form performs the real persist and reports back. */
export function ProfileSaveButton() {
  const t = useT();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    function onSaved() { setSaved(true); setTimeout(() => setSaved(false), 1600); }
    window.addEventListener(SAVE_EVENT + ":done", onSaved);
    return () => window.removeEventListener(SAVE_EVENT + ":done", onSaved);
  }, []);
  if (saved) return <span className="oauth-ok" style={{ padding: "6px 11px" }}><Icon name="check" size={13} /> {t("common.saved")}</span>;
  return (
    <button className="btn-accent" onClick={() => window.dispatchEvent(new CustomEvent(SAVE_EVENT))}>
      <Icon name="check" size={14} /> {t("profile.saveChanges")}
    </button>
  );
}

/* ---------- Account ---------- */
function AccountTab({ account }: { account: Account }) {
  const t = useT();
  const [name, setName] = useState(account.name);
  const [addressAs, setAddressAs] = useState(account.addressAs);
  const [lang, setLang] = useState(account.lang);
  const [tz, setTz] = useState(account.tz);
  const [, start] = useTransition();

  useEffect(() => {
    function onSave() {
      start(async () => {
        await updateProfile({ name, addressAs, lang, tz });
        window.dispatchEvent(new CustomEvent(SAVE_EVENT + ":done"));
      });
    }
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
  }, [name, addressAs, lang, tz, start]);

  const [image, setImage] = useState<string | null>(account.image ?? null);

  return (
    <>
      <div className="set-card">
        <div className="set-row" style={{ paddingTop: 0 }}>
          <AvatarUpload name={name || t("profile.operatorFallback")} color="#9a5cff" image={image} size={64} onChange={(p) => { setImage(p); start(() => updateProfile({ image: p })); }} />
          <div className="sr-main">
            <div className="sr-title" style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
            <div className="sr-sub">{account.email} · {t("profile.role.owner")}</div>
          </div>
        </div>
      </div>
      <div className="set-card">
        <h4>{t("profile.account.title")}</h4>
        <div className="set-desc">{t("profile.account.desc")}</div>
        <div className="set-grid">
          <div className="form-field"><label className="form-label">{t("common.name")}</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="form-field"><label className="form-label">{t("profile.field.email")}</label><input className="form-input" value={account.email} readOnly /></div>
        </div>
      </div>
      <div className="set-card">
        <h4>{t("profile.operatorContext.title")}</h4>
        <div className="set-desc">{t("profile.operatorContext.desc")}</div>
        <div className="set-grid">
          <div className="form-field"><label className="form-label">{t("profile.field.addressAs")}</label><input className="form-input" value={addressAs} onChange={(e) => setAddressAs(e.target.value)} /></div>
          <div className="form-field"><label className="form-label">{t("profile.field.agentLanguage")}</label>
            <select className="form-input" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option>English (US)</option><option>Português (BR)</option><option>Español</option>
            </select>
          </div>
          <div className="form-field"><label className="form-label">{t("profile.field.interfaceLanguage")}</label><div style={{ paddingTop: 4 }}><LangSwitch /></div></div>
          <div className="form-field"><label className="form-label">{t("profile.field.timezone")}</label>
            <select className="form-input" value={tz} onChange={(e) => setTz(e.target.value)}>
              <option>UTC</option><option>America/Sao_Paulo</option><option>America/New_York</option><option>Europe/Lisbon</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Security ---------- */
function SecurityTab({ passkeys }: { account: Account; passkeys: PasskeyRow[] }) {
  const t = useT();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  // 2FA — DISABLED for now: hidden from the Profile UI and the twoFactor() server plugin (lib/auth.ts) is
  // commented out too. Not for public yet. State + handlers + the UI block stay (commented) so re-enabling
  // is just: uncomment these, the handlers, the UI block, restore the `account` destructure, and add
  // twoFactor() back to the plugins array in lib/auth.ts.
  // const [twofaOn, setTwofaOn] = useState(account.twoFactorEnabled);
  // const [totpUri, setTotpUri] = useState("");
  // const [code, setCode] = useState("");
  // const [pw2fa, setPw2fa] = useState("");
  // const [show2fa, setShow2fa] = useState(false);

  // Passkey (real WebAuthn)
  const hasPasskey = passkeys.length > 0;

  async function changePassword() {
    setBusy(true); setMsg("");
    const res = await authClient.changePassword({ currentPassword: cur, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    setMsg(res.error ? (res.error.message ?? t("profile.msg.failed")) : t("profile.msg.passwordUpdated"));
    if (!res.error) { setCur(""); setNext(""); }
  }

  // 2FA handlers — DISABLED (see note above). Kept for easy restore.
  /* async function enable2FA() {
    setMsg("");
    const res = await authClient.twoFactor.enable({ password: pw2fa });
    if (res.error) { setMsg(res.error.message ?? t("profile.msg.failed")); return; }
    setTotpUri(res.data?.totpURI ?? "");
  }
  async function verify2FA() {
    const res = await authClient.twoFactor.verifyTotp({ code });
    if (res.error) { setMsg(res.error.message ?? t("profile.msg.invalidCode")); return; }
    setTwofaOn(true); setTotpUri(""); setCode(""); setPw2fa(""); setShow2fa(false); router.refresh();
  }
  async function disable2FA() {
    const res = await authClient.twoFactor.disable({ password: pw2fa });
    if (res.error) { setMsg(res.error.message ?? t("profile.msg.failed")); return; }
    setTwofaOn(false); setPw2fa(""); setShow2fa(false); router.refresh();
  } */

  async function addPasskey() {
    setMsg("");
    try {
      const opts = await fetch("/api/passkey/register/options", { method: "POST" }).then((r) => r.json());
      if (opts.error) { setMsg(opts.error); return; }
      const att = await startRegistration({ optionsJSON: opts });
      const res = await fetch("/api/passkey/register/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response: att, name: "Passkey" }) }).then((r) => r.json());
      if (res.error) { setMsg(res.error); return; }
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : t("profile.msg.passkeyCancelled")); }
  }

  return (
    <>
      <div className="set-card">
        <h4>{t("profile.password.title")}</h4>
        <div className="set-desc">{t("profile.password.desc")}</div>
        <div className="set-grid">
          <div className="form-field"><label className="form-label">{t("profile.field.currentPassword")}</label><input className="form-input" type="password" placeholder="••••••••" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="form-field"><label className="form-label">{t("profile.field.newPassword")}</label><input className="form-input" type="password" placeholder="••••••••" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy || cur.length < 8 || next.length < 8} onClick={changePassword}><Icon name="shield" size={13} /> {t("profile.password.update")}</button>
        {msg && <div className="sr-sub" style={{ marginTop: 8 }}>{msg}</div>}
      </div>

      <div className="set-card">
        <h4>{t("profile.auth.title")}</h4>
        <div className="set-desc">{t("profile.auth.desc")}</div>

        <div className="set-row">
          <div className="brand-ico"><Icon name="account" size={15} /></div>
          <div className="sr-main"><div className="sr-title">{t("profile.passkey.label")} {hasPasskey && <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{passkeys.length}</span>}</div><div className="sr-sub">{t("profile.passkey.desc")}</div></div>
          <button className="btn-ghost" onClick={addPasskey}><Icon name="add" size={13} /> {t("profile.passkey.add")}</button>
        </div>
        {passkeys.map((p) => (
          <div className="set-row" key={p.id}>
            <div className="brand-ico"><Icon name="shield" size={15} /></div>
            <div className="sr-main"><div className="sr-title">{p.name} {p.backedUp && <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{t("profile.passkey.synced")}</span>}</div><div className="sr-sub">{t("profile.passkey.added", { date: new Date(p.createdAt * 1000).toLocaleDateString() })}</div></div>
            <button className="link-btn" style={{ color: "var(--sx-keyword)" }} disabled={pending} onClick={() => start(() => removePasskey(p.id))}>{t("common.remove")}</button>
          </div>
        ))}
        {!hasPasskey && <div className="set-row"><div className="sr-main"><div className="sr-sub" style={{ color: "var(--text-faint)" }}>{t("profile.passkey.none")}</div></div></div>}

        <div className="set-row">
          <div className="brand-ico"><Icon name="account" size={15} /></div>
          <div className="sr-main"><div className="sr-title">{t("profile.biometrics.label")}</div><div className="sr-sub">{t("profile.biometrics.desc")}</div></div>
          <div className={"toggle" + (hasPasskey ? " on" : "")} style={{ opacity: 0.5, cursor: "default" }} />
        </div>

        {/* 2FA DISABLED — removed from the Profile UI (not for public yet); the twoFactor() server plugin is
            also commented out in lib/auth.ts. Restore this block + the state/handlers above + the plugin to re-enable.
        <div className="set-row">
          <div className="sr-main"><div className="sr-title">{t("profile.twofa.label")}</div><div className="sr-sub">{twofaOn ? t("profile.twofa.desc") : t("profile.twofa.descRecommended")}</div></div>
          <div className={"toggle" + (twofaOn ? " on" : "")} onClick={() => { setShow2fa((v) => !v); setMsg(""); }} />
        </div>
        {show2fa && !twofaOn && !totpUri && (
          <div className="set-row" style={{ borderBottom: "none" }}>
            <div className="sr-main"><input className="form-input" type="password" placeholder={t("profile.field.confirmPassword")} value={pw2fa} onChange={(e) => setPw2fa(e.target.value)} style={{ maxWidth: 260 }} /></div>
            <button className="btn-accent" disabled={pw2fa.length < 8} onClick={enable2FA}>{t("profile.twofa.enable")}</button>
          </div>
        )}
        {totpUri && (
          <div className="set-row" style={{ borderBottom: "none", display: "block" }}>
            <div className="set-desc">{t("profile.twofa.scanHint")}</div>
            <span className="token-pill" style={{ wordBreak: "break-all", display: "block", padding: 8, marginBottom: 8 }}>{totpUri}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 160 }} />
              <button className="btn-accent" onClick={verify2FA}>{t("profile.twofa.verify")}</button>
            </div>
          </div>
        )}
        {show2fa && twofaOn && (
          <div className="set-row" style={{ borderBottom: "none" }}>
            <div className="sr-main"><input className="form-input" type="password" placeholder={t("profile.field.confirmPassword")} value={pw2fa} onChange={(e) => setPw2fa(e.target.value)} style={{ maxWidth: 260 }} /></div>
            <button className="btn-danger" disabled={pw2fa.length < 8} onClick={disable2FA}>{t("profile.twofa.disable")}</button>
          </div>
        )}
        */}
        {msg && <div className="sr-sub" style={{ marginTop: 8 }}>{msg}</div>}
      </div>

      <div className="set-card danger-card">
        <h4 style={{ color: "var(--sx-keyword)" }}>{t("profile.danger.title")}</h4>
        <div className="set-desc">{t("profile.danger.desc")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-danger" disabled={pending} onClick={() => start(() => revokeOtherSessionsAction())}><Icon name="close" size={13} /> {t("profile.danger.signOutOthers")}</button>
          <button className="btn-danger" disabled={pending} onClick={() => { if (confirm(t("profile.danger.deleteConfirm"))) start(() => deleteAccountAction()); }}><Icon name="trash" size={13} /> {t("profile.danger.deleteAccount")}</button>
        </div>
      </div>
    </>
  );
}

/* ---------- Tokens ---------- */
function TokensTab({ tokens }: { tokens: TokenRow[] }) {
  const t = useT();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("read");
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function gen() {
    start(async () => { const res = await createPAT(name || "New token", scope); setCreated(res.token); setName(""); });
  }
  return (
    <div className="set-card">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div><h4 style={{ marginBottom: 2 }}>{t("profile.tokens.title")}</h4><div className="set-desc" style={{ margin: 0 }}>{t("profile.tokens.desc")}</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="form-input" placeholder={t("profile.tokens.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="form-input" value={scope} onChange={(e) => setScope(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="read">read</option><option value="repo, deploy">repo, deploy</option><option value="full">full</option>
        </select>
        <button className="btn-accent" disabled={pending} onClick={gen}><Icon name="add" size={13} /> {t("profile.tokens.generate")}</button>
      </div>
      {created && (
        <div className="set-card" style={{ background: "var(--bg-app)", marginBottom: 12 }}>
          <div className="set-desc" style={{ margin: 0 }}>{t("profile.tokens.copyNow")}</div>
          <span className="token-pill" style={{ display: "block", padding: 8, marginTop: 6, wordBreak: "break-all" }}>{created}</span>
        </div>
      )}
      {tokens.map((tk) => (
        <div className="set-row" key={tk.id}>
          <div className="brand-ico"><Icon name="skill" size={15} /></div>
          <div className="sr-main"><div className="sr-title">{tk.name}</div><div className="sr-sub">{t("profile.tokens.scope", { scope: tk.scope })}{tk.lastUsed ? ` · ${t("profile.tokens.used", { date: new Date(tk.lastUsed * 1000).toLocaleDateString() })}` : ` · ${t("profile.tokens.neverUsed")}`}</div></div>
          <span className="token-pill">{tk.prefix}••••</span>
          <RevokeTokenBtn id={tk.id} />
        </div>
      ))}
      {tokens.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 12.5, padding: "8px 0" }}>{t("profile.tokens.none")}</div>}
    </div>
  );
}
function RevokeTokenBtn({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return <button className="link-btn" style={{ color: "var(--sx-keyword)" }} disabled={pending} onClick={() => start(() => revokePAT(id))}>{t("common.revoke")}</button>;
}

/* ---------- Connections ---------- */
function ConnectionsTab({ connections }: { connections: Props["connections"] }) {
  const t = useT();
  const router = useRouter();
  const [tgOpen, setTgOpen] = useState(false);
  const [bot, setBot] = useState("");
  const [chat, setChat] = useState("");
  const [tgName, setTgName] = useState("");
  const [tgErr, setTgErr] = useState("");
  const [pending, start] = useTransition();

  const PROVIDERS: { k: string; name: string; glyph: IconName }[] = [
    { k: "github", name: "GitHub", glyph: "git" },
    { k: "google", name: "Google", glyph: "account" },
  ];

  async function link(provider: string) {
    await authClient.linkSocial({ provider: provider as "github" | "google", callbackURL: "/profile" });
  }

  return (
    <div className="set-card">
      <h4>{t("profile.connections.title")}</h4>
      <div className="set-desc">{t("profile.connections.desc")}</div>
      {PROVIDERS.map((p) => {
        const configured = connections.providers.includes(p.k);
        const linked = connections.linked.includes(p.k);
        return (
          <div className="set-row" key={p.k}>
            <div className="brand-ico"><Icon name={p.glyph} size={15} /></div>
            <div className="sr-main"><div className="sr-title">{p.name}</div><div className="sr-sub">{t(`profile.provider.${p.k}.sub`)}</div></div>
            {!configured
              ? <span className="sr-sub" style={{ color: "var(--text-faint)" }}>{t("profile.connections.configureCredentials")}</span>
              : linked
                ? <><span className="oauth-ok" style={{ padding: "4px 9px", fontSize: 11.5 }}><Icon name="check" size={12} /> {t("common.connected")}</span>
                    <button className="link-btn" style={{ color: "var(--sx-keyword)" }} disabled={pending} onClick={() => start(() => unlinkSocial(p.k))}>{t("common.disconnect")}</button></>
                : <button className="btn-ghost" onClick={() => link(p.k)}>{t("common.connect")}</button>}
          </div>
        );
      })}
      <div className="set-row">
        <div className="brand-ico"><Icon name="bell" size={15} /></div>
        <div className="sr-main"><div className="sr-title">{t("profile.telegram.title")}</div><div className="sr-sub">{t("profile.telegram.desc")}</div></div>
        {connections.telegram
          ? <><span className="oauth-ok" style={{ padding: "4px 9px", fontSize: 11.5 }}><Icon name="check" size={12} /> {t("common.connected")}</span>
              <button className="link-btn" style={{ color: "var(--sx-keyword)" }} disabled={pending} onClick={() => start(() => disconnectTelegram())}>{t("common.disconnect")}</button></>
          : <button className="btn-ghost" onClick={() => setTgOpen((v) => !v)}>{t("common.connect")}</button>}
      </div>
      {tgOpen && !connections.telegram && (
        <div className="set-row" style={{ borderBottom: "none", gap: 8, flexWrap: "wrap" }}>
          <input className="form-input" placeholder={t("profile.telegram.botPlaceholder")} value={bot} onChange={(e) => setBot(e.target.value)} />
          <input className="form-input" placeholder={t("profile.telegram.chatPlaceholder")} value={chat} onChange={(e) => setChat(e.target.value)} style={{ maxWidth: 150 }} />
          <input className="form-input" placeholder={t("profile.telegram.namePlaceholder")} value={tgName} onChange={(e) => setTgName(e.target.value)} style={{ maxWidth: 150 }} />
          <button className="btn-accent" disabled={pending || !bot || !chat} onClick={() => { setTgErr(""); start(async () => { const r = await connectTelegram(bot, chat, tgName); if (!r.ok) { setTgErr(r.error ?? t("profile.msg.failed")); return; } setTgOpen(false); setBot(""); setChat(""); setTgName(""); router.refresh(); }); }}>{t("common.save")}</button>
          {tgErr && <div style={{ fontSize: 11, color: "#e8688f", width: "100%" }}>{tgErr}</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Notifications ---------- */
function NotificationsTab({ prefs }: { prefs: Props["prefs"] }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState(prefs);
  const [pending, start] = useTransition();
  const ROWS: (keyof Omit<Props["prefs"], "reducedMotion">)[] = ["email", "telegram", "inapp", "weekly"];
  function toggle(k: keyof Omit<Props["prefs"], "reducedMotion">) {
    if (pending) return;
    const v = !state[k]; setState((s) => ({ ...s, [k]: v })); start(() => setNotifPref(k, v));
  }
  function toggleMotion() {
    if (pending) return;
    const v = !state.reducedMotion;
    setState((s) => ({ ...s, reducedMotion: v }));
    start(async () => { await setMotionPref(v); router.refresh(); });
  }
  return (
    <div className="set-card">
      <h4>{t("profile.notif.title")}</h4>
      <div className="set-desc">{t("profile.notif.desc")}</div>
      {ROWS.map((k) => (
        <div className="set-row" key={k}>
          <div className="sr-main"><div className="sr-title">{t(`profile.notif.${k}.label`)}</div><div className="sr-sub">{t(`profile.notif.${k}.desc`)}</div></div>
          <div className={"toggle" + (state[k] ? " on" : "")} onClick={() => toggle(k)} />
        </div>
      ))}
      <div className="set-row">
        <div className="sr-main"><div className="sr-title">{t("profile.notif.reducedMotion.label")}</div><div className="sr-sub">{t("profile.notif.reducedMotion.desc")}</div></div>
        <div className={"toggle" + (state.reducedMotion ? " on" : "")} onClick={toggleMotion} />
      </div>
    </div>
  );
}

/* ---------- Sessions ---------- */
function SessionsTab({ sessions }: { sessions: SessionRow[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <>
      <div className="set-card">
        <h4>{t("profile.sessions.title")}</h4>
        <div className="set-desc">{t("profile.sessions.desc")}</div>
        {sessions.map((s) => (
          <div className="set-row" key={s.id}>
            <div className="brand-ico"><Icon name="cpu" size={15} /></div>
            <div className="sr-main"><div className="sr-title">{s.device.slice(0, 60)} {s.current && <span className="pill" style={{ background: "var(--sx-string)22", color: "var(--sx-string)" }}>{t("profile.sessions.current")}</span>}</div><div className="sr-sub">{s.ip || t("profile.sessions.local")} · {t("profile.sessions.since", { date: new Date(s.createdAt * 1000).toLocaleDateString() })}</div></div>
            {!s.current && <button className="link-btn" style={{ color: "var(--sx-keyword)" }} disabled={pending} onClick={() => start(() => revokeSessionAction(s.token))}>{t("profile.sessions.end")}</button>}
          </div>
        ))}
        {sessions.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 12.5, padding: "8px 0" }}>{t("profile.sessions.none")}</div>}
      </div>
    </>
  );
}
