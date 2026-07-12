"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useT } from "@/lib/i18n-context";
import { Icon } from "@/components/ui/icon";
import { seedDefaultBlocksAction } from "@/server/actions/blocks-actions";

// The Welcome Home "Central knowledge" empty-state. Instead of dead text, it actually creates the
// default central blocks (mission / objective / official-stack) from the workspace, and links to
// Knowledge to add more.
export function HomeSeedBlocks() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="home-empty">
      <div>{t("home.canonical.empty")}</div>
      <div className="hse-actions">
        <button className="hse-create" disabled={pending} onClick={() => start(async () => { await seedDefaultBlocksAction(); router.refresh(); })}>
          <Icon name="add" size={13} /> {pending ? t("home.creating") : t("home.createBlocks")}
        </button>
        <Link href={"/knowledge" as Route} className="hse-link">{t("home.openKnowledge")} →</Link>
      </div>
    </div>
  );
}
