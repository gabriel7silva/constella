"use client";

import { createContext, useContext } from "react";
import { t as translate, type Lang } from "@/lib/i18n";

/** Active language, seeded from the server (the cn-lang cookie, resolved in layout.tsx). */
const LangCtx = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

/** Client translator hook: `const t = useT(); t("login.signin")`. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const lang = useContext(LangCtx);
  return (key, vars) => translate(lang, key, vars);
}

export function useLang(): Lang {
  return useContext(LangCtx);
}
