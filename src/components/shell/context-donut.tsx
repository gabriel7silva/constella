"use client";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n-context";
import type { ContextStat } from "@/server/actions/context-actions";

// Token counts get a "tks" unit so the numbers aren't loose/ambiguous (e.g. "200.0k tks", "752 tks").
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)) + " tks";

/**
 * Small context-occupancy donut for the chat header: how much of the model's context
 * window the conversation is using, with a reserve band and remaining balance. Hover
 * reveals per-agent token consumption. A "Compact" button appears when the remaining
 * context drops below 35% (auto-compaction also fires at 100%, handled by the dock).
 */
export function ContextDonut({ stat, onCompact, compacting }: {
  stat: ContextStat; onCompact: () => void; compacting: boolean;
}) {
  const t = useT();
  const R = 15, C = 2 * Math.PI * R;
  const usedLen = Math.min(1, stat.used / stat.max) * C;
  const reserveLen = Math.min(1, stat.reserve / stat.max) * C;
  const usedColor = stat.usedPct >= 85 ? "#e8688f" : stat.usedPct >= 65 ? "#e0a44e" : "#b3d97a";
  const lowContext = stat.remainingPct <= 35;
  // The donut shows USED, which climbs from 0 as you chat (it does NOT count down). Show "<1%" instead of a
  // flat "0%" once anything is in the conversation, so a small-but-real usage doesn't read as empty.
  const usedLabel = stat.used > 0 && stat.usedPct < 1 ? "<1%" : `${stat.usedPct}%`;

  return (
    <div className="ctx-donut-wrap">
      <div className="ctx-donut" tabIndex={0}>
        <svg width={38} height={38} viewBox="0 0 38 38">
          <circle cx={19} cy={19} r={R} fill="none" stroke="var(--border)" strokeWidth={4} />
          <circle cx={19} cy={19} r={R} fill="none" stroke={usedColor} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={`${usedLen} ${C}`} transform="rotate(-90 19 19)" />
          <circle cx={19} cy={19} r={R} fill="none" stroke="var(--text-faint)" strokeWidth={4}
            strokeDasharray={`${reserveLen} ${C}`} strokeDashoffset={-usedLen} transform="rotate(-90 19 19)" />
          <text x={19} y={20} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="var(--text)">{usedLabel}</text>
        </svg>

        <div className="ctx-pop">
          <div className="ctx-pop-title"><Icon name="pulse" size={12} /> {t("chrome.ctx.title")}</div>
          <div className="ctx-rows">
            <div><span>{t("chrome.ctx.max")}</span><b>{fmt(stat.max)}</b></div>
            <div><span>{t("chrome.ctx.used")}</span><b style={{ color: usedColor }}>{fmt(stat.used)} · {usedLabel}</b></div>
            <div><span>{t("chrome.ctx.reserve")}</span><b>{fmt(stat.reserve)} · {stat.reservePct}%</b></div>
            <div><span>{t("chrome.ctx.remaining")}</span><b>{fmt(stat.remaining)} · {stat.remainingPct}%</b></div>
          </div>
          {stat.perAgent.length > 0 && (
            <>
              <div className="ctx-pop-sub">{t("chrome.ctx.byAgent")}</div>
              <div className="ctx-agents">
                {stat.perAgent.slice(0, 8).map((a) => (
                  <div className="ctx-agent" key={a.handle}>
                    <Avatar name={a.name} color={a.color} size={18} />
                    <span className="ctx-agent-name">{a.name}</span>
                    <span className="ctx-agent-bar"><span style={{ width: `${a.pct}%`, background: a.color }} /></span>
                    <span className="ctx-agent-tok">{fmt(a.tokens)} · {a.pct}%{a.usd > 0 ? ` · $${a.usd.toFixed(2)}` : ""}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="ctx-pop-note">{t("chrome.ctx.explain")}</div>
        </div>
      </div>
      {lowContext && (
        <button className="ctx-compact" onClick={onCompact} disabled={compacting} title={t("chrome.ctx.compactHint")}>
          {compacting ? <span className="spin"><Icon name="refresh" size={12} /></span> : <Icon name="collapse" size={12} />}
          {compacting ? t("chrome.ctx.compacting") : t("chrome.ctx.compact")}
        </button>
      )}
    </div>
  );
}
