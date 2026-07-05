"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function toggleTheme(current: string) {
  const next = current === "light" ? "dark" : "light";
  (await cookies()).set("cn-theme", next, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Toggle the animated background on/off (GPU savings). Default on; `cn-anim=off` disables it. */
export async function toggleAnim() {
  const c = await cookies();
  const next = c.get("cn-anim")?.value === "off" ? "on" : "off";
  c.set("cn-anim", next, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Set the UI language (cn-lang cookie). "pt" = Portuguese-BR, anything else = English. */
export async function setLang(lang: string) {
  const next = lang === "pt" ? "pt" : "en";
  (await cookies()).set("cn-lang", next, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
