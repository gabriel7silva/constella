// After `next build` with `output: "standalone"`, Next emits a self-contained server at
// `.next/standalone/server.js` but does NOT copy the client assets (`.next/static`) or
// `public/` into it. Without this, `node .next/standalone/server.js` serves HTML whose
// JS/CSS 404 → screens render unstyled / don't hydrate / navigation breaks. Copy them in.
import { cpSync, existsSync } from "node:fs";

const SB = ".next/standalone";
let copied = [];
if (existsSync(".next/static")) { cpSync(".next/static", `${SB}/.next/static`, { recursive: true }); copied.push(".next/static"); }
if (existsSync("public")) { cpSync("public", `${SB}/public`, { recursive: true }); copied.push("public"); }
console.log(`[postbuild] standalone assets copied: ${copied.join(", ") || "(none found)"}`);
