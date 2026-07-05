"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Global Ctrl/⌘ + P (and ⌘K) opens the command palette at /search. */
export function SearchHotkey() {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k" || e.key === "P" || e.key === "K")) {
        e.preventDefault();
        router.push("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
