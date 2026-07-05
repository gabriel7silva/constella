"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { tick, autoTick } from "@/server/actions/runner-actions";

/**
 * Two loops, both paused when the tab is hidden:
 *  - Health heartbeat (every `intervalMs`): cheap `tick()` (execute:false) keeps pulse/health
 *    fresh and refreshes the UI when a status dot flips.
 *  - Organic execution loop: while the plan is approved AND Run 24/7 is on, runs ONE task via
 *    `autoTick()`, then CHAINS to the next as soon as it finishes — task by task until the board
 *    drains, then idles. This is what makes "Run 24/7" actually execute in the open tab.
 */
export function RunnerHeartbeat({ intervalMs = 8000, approved = false, auto247 = false }: {
  intervalMs?: number; approved?: boolean; auto247?: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const runInFlight = useRef(false);
  // Seeded to "now" so pre-existing planner events (from before this tab opened) never
  // trigger a spurious refresh — only a NEW terminal planner event moves this forward.
  const plannerSeq = useRef(Date.now());

  // cheap health heartbeat
  useEffect(() => {
    let stop = false;
    async function beat() {
      if (stop || busy.current || document.hidden) return;
      busy.current = true;
      try {
        const r = await tick(plannerSeq.current);
        if (!r.paused) {
          plannerSeq.current = r.plannerSeq;
          if (r.advanced || (r.changed ?? 0) > 0 || r.plannerChanged) router.refresh();
        }
      } catch { /* ignore transient errors */ } finally { busy.current = false; }
    }
    beat();
    const id = setInterval(beat, intervalMs);
    const onVis = () => { if (!document.hidden) beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [intervalMs, router]);

  // organic execution loop — chain task-by-task while Run 24/7 is on + tab visible
  useEffect(() => {
    let stop = false;
    async function runLoop() {
      if (stop || runInFlight.current || document.hidden) return;
      if (!approved || !auto247) return;
      runInFlight.current = true;
      try {
        const r = await autoTick();
        if (r.ran) router.refresh();
        // continue only while real progress was made and runnable work remains (avoids hot-looping
        // on capped/blocked tasks; resumes on the next mount / visibility / Run-24/7 toggle).
        if (!stop && !r.paused && r.ran && r.remaining > 0 && !document.hidden) setTimeout(runLoop, 1200);
      } catch { /* transient */ } finally { runInFlight.current = false; }
    }
    runLoop();
    const onVis = () => { if (!document.hidden) runLoop(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; document.removeEventListener("visibilitychange", onVis); };
  }, [approved, auto247, router]);

  return null;
}
