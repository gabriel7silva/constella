"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";

/** Real browser back (history), falling back to the dashboard when there is no history. */
export function BackButton() {
  const t = useT();
  const router = useRouter();
  return (
    <button
      className="top-btn"
      title={t("common.back")}
      style={{ marginRight: 2 }}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      <Icon name="chevronLeft" size={18} />
    </button>
  );
}
