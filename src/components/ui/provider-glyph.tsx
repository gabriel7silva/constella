"use client";

import { useState } from "react";
import { providerIconUrl } from "@/data/provider-icons";

/** Provider brand glyph — the real brand logo (simple-icons, white) on the provider's brand-color
 *  gradient; falls back to a colored monogram when there's no mapped icon or the SVG 404s. */
export const PROVIDER_BRAND: Record<string, [string, string]> = {
  anthropic: ["#d97757", "An"], openai: ["#10a37f", "AI"], google_gemini: ["#4285f4", "G"], google: ["#4285f4", "G"],
  mistral: ["#fa520f", "Mi"], xai_grok: ["#1a1a1a", "X"], deepseek: ["#4d6bfe", "DS"], cohere: ["#39594d", "Co"],
  ai21: ["#e8488a", "A2"], perplexity: ["#20808d", "Px"], groq: ["#f55036", "Gq"], nvidia_nim: ["#76b900", "NV"],
  together: ["#0f6fff", "To"], fireworks: ["#5019c5", "Fw"], cerebras: ["#f25733", "Cb"], huggingface: ["#ff9d00", "HF"],
  replicate: ["#1a1a1a", "Rp"], openrouter: ["#6566f1", "OR"], litellm: ["#00b8a3", "LL"], portkey: ["#3b5bdb", "Pk"],
  azure_openai: ["#0078d4", "Az"], aws_bedrock: ["#ff9900", "Br"], vertex_ai: ["#4285f4", "Vx"], cloudflare: ["#f38020", "Cf"],
  dashscope: ["#ff6a00", "Qw"], zhipu: ["#3859ff", "GL"], moonshot: ["#16162a", "Ki"], minimax: ["#e1342c", "MM"],
  ollama: ["#0c0c0c", "Ol"], llamacpp: ["#7a4ddb", "Lc"], lmstudio: ["#4a5cff", "LM"], vllm: ["#1668dc", "vL"],
  localai: ["#2e7d32", "La"], gpt4all: ["#5b6cff", "G4"], jan: ["#1a1a1a", "Jn"], claude_code: ["#d97757", "CC"],
  codex_cli: ["#10a37f", "Cx"], gemini_cli: ["#4285f4", "Gc"], aider: ["#14b8a6", "Ad"], ollama_cli: ["#0c0c0c", "Oc"],
  openclaw: ["#e8590c", "OC"], hermes_cli: ["#6d28d9", "Hm"],
  opencode: ["#1a1a1a", "Oc"], copilot_cli: ["#1f2328", "Co"], cursor_cli: ["#1a1a1a", "Cu"], cline_cli: ["#2563eb", "Cl"], kilo_code: ["#7c3aed", "Ki"],
  voyage: ["#5b21b6", "Vo"], jina: ["#ec4899", "Ji"], stability: ["#a855f7", "St"], elevenlabs: ["#1a1a1a", "El"],
};

export function ProviderGlyph({ id, size = 34, radius }: { id: string; size?: number; radius?: number }) {
  const b = PROVIDER_BRAND[id];
  const color = b ? b[0] : "#5b6378";
  const label = b ? b[1] : (id || "?").slice(0, 2).replace(/[^a-z0-9]/gi, "").toUpperCase();
  const url = providerIconUrl(id);
  const [failed, setFailed] = useState(false);
  const br = radius != null ? radius : Math.round(size * 0.28);
  const showIcon = url && !failed;
  const ic = Math.round(size * 0.66);
  return (
    <span className="prov-glyph" style={{
      width: size, height: size, flex: "0 0 " + size + "px", borderRadius: br,
      // Real brand logo (color) sits on a light chip; the monogram keeps the brand-color gradient.
      background: showIcon ? "#fff" : "linear-gradient(150deg, " + color + ", color-mix(in srgb, " + color + " 70%, #000))",
      color: "#fff", display: "grid", placeItems: "center", overflow: "hidden",
      fontSize: Math.round(size * 0.4), fontWeight: 800, letterSpacing: "-.5px",
      boxShadow: showIcon ? "inset 0 0 0 1px rgba(0,0,0,.08)" : "inset 0 1px 0 rgba(255,255,255,.18)",
    }}>
      {showIcon
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" width={ic} height={ic} loading="lazy" onError={() => setFailed(true)} style={{ width: ic, height: ic, objectFit: "contain", display: "block" }} />
        : label}
    </span>
  );
}
