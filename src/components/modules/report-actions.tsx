"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { generateReport } from "@/server/reports";
import { useT } from "@/lib/i18n-context";

/** Triggers a REAL agent run that writes a Markdown report; opens it on success. */
export function GenerateReportButton() {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-accent"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateReport();
          if (r.ok && r.id) router.push(`/reports/${r.id}`);
          else router.refresh();
        })
      }
    >
      <Icon name="doc" size={14} className={pending ? "sync-spin" : ""} /> {pending ? t("reports.generating") : t("reports.generate")}
    </button>
  );
}
