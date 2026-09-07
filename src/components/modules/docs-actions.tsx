"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { generateDocs } from "@/server/docs";
import { useT } from "@/lib/i18n-context";

/** Triggers a REAL run where the Docs agent (@barbara) writes/refreshes a DOCS/*.md. */
export function GenerateDocsButton() {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-accent"
      disabled={pending}
      onClick={() => start(async () => { await generateDocs(); router.refresh(); })}
    >
      <Icon name="doc" size={14} className={pending ? "sync-spin" : ""} /> {pending ? t("docs.writing") : t("docs.generate")}
    </button>
  );
}
