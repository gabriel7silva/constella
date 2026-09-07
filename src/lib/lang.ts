/** Map a file extension to a syntax language id (used by the Code editor). */
const LANG: Record<string, string> = { ts: "ts", tsx: "tsx", js: "ts", jsx: "tsx", json: "json", md: "md", py: "py", go: "ts", rs: "ts", css: "ts", html: "ts", yml: "yaml", yaml: "yaml" };

export const langOf = (p: string) => LANG[p.split(".").pop()!.toLowerCase()] ?? "text";
