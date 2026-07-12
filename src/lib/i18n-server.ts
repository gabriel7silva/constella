import "server-only";
import { cookies } from "next/headers";
import { t as translate, normalizeLang, type Lang } from "@/lib/i18n";

/** Active UI language for a Server Component (the cn-lang cookie). */
export async function getServerLang(): Promise<Lang> {
  return normalizeLang((await cookies()).get("cn-lang")?.value);
}

/** Bound translator for Server Components: `const t = await getT(); t("reports.title")`. */
export async function getT(): Promise<(key: string, vars?: Record<string, string | number>) => string> {
  const lang = await getServerLang();
  return (key, vars) => translate(lang, key, vars);
}
