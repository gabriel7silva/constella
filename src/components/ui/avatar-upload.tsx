"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { useT } from "@/lib/i18n-context";

/** Resize a picked image to a small square-ish thumbnail and return a data URL — avatars live in the
 *  DB (agent.image / user.image), NOT in the workspace, so they never pollute the agent's file tree,
 *  the RAG index or a clean export. ~160px webp ≈ 10-15 KB. */
function toAvatarDataUrl(file: File, max = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let out = c.toDataURL("image/webp", 0.85);
      if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", 0.85); // Safari < webp
      if (out.length > 600_000) out = c.toDataURL("image/jpeg", 0.6); // hard cap on DB row size
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("invalid image")); };
    img.src = url;
  });
}

/** Avatar + image-upload control. Resizes the picked photo client-side to a small data URL and calls
 *  onChange with it (or null to clear) — stored in the DB, never the workspace. Reused for the user
 *  (Profile) and agents (Agent Studio). */
export function AvatarUpload({ name, color, image, size = 64, onChange }: {
  name: string; color: string; image?: string | null; size?: number;
  onChange: (path: string | null) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [, start] = useTransition();

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const dataUrl = await toAvatarDataUrl(file);
      start(() => onChange(dataUrl));
    } catch { setErr(t("chrome.avatar.processError")); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  return (
    <div className="avatar-upload">
      <Avatar name={name} color={color} image={image} size={size} />
      <div className="avatar-upload-actions">
        <button className="btn-ghost" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? <span className="sync-spin"><Icon name="refresh" size={12} /></span> : <Icon name="add" size={12} />} {image ? t("chrome.avatar.change") : t("chrome.avatar.upload")}
        </button>
        {err && <span style={{ fontSize: 11, color: "#e8688f" }}>{err}</span>}
        <input ref={ref} type="file" accept=".png,.jpg,.jpeg,.gif,.webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
