"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useT } from "@/lib/i18n-context";
import { stopAllRunsClient } from "@/lib/run-client";

/** Pulse's global "Stop All" — interrupts every currently-running agent at once. Destructive-adjacent
 *  (kills in-flight work across the whole workspace), so it confirms first like Fire agent. */
export function StopAllButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function confirmStop() {
    setErr("");
    start(async () => {
      const r = await stopAllRunsClient();
      if (r.ok) { setOpen(false); router.refresh(); } else { setErr(t("pulse.stopAll.error")); }
    });
  }

  return (
    <>
      <button className="btn-ghost" style={{ color: "var(--sx-keyword)" }} onClick={() => { setErr(""); setOpen(true); }}>
        <Icon name="close" size={13} /> {t("pulse.stopAll.button")}
      </button>
      {open && (
        <ConfirmDialog
          title={t("pulse.stopAll.button")}
          body={t("pulse.stopAll.confirm")}
          confirmLabel={t("pulse.stopAll.button")}
          error={err}
          pending={pending}
          onConfirm={confirmStop}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
