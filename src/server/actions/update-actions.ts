"use server";

import { requireWorkspace } from "@/lib/workspace";
import { detectRunContext } from "@/lib/run-context";
import { checkForUpdate, type UpdateInfo } from "@/server/update-check";
import { startUpdate, getUpdateResult, type UpdateResult } from "@/server/update-run";
import { anyAgentWorking } from "@/server/agent-pulse";

/** Version status (current vs latest on npm) — read-only, cached, fails silently when offline. */
export async function getUpdateStatus(force = false): Promise<UpdateInfo> {
  return checkForUpdate(force);
}

export type UpdateState = { info: UpdateInfo; busy: boolean };

/** Update availability + whether an agent is actively working (gates the update button). The npm part honors
 *  the cache unless `force`; the `busy` flag is always live, so the UI can poll this cheaply for both. */
export async function getUpdateState(force = false): Promise<UpdateState> {
  const [info, busy] = await Promise.all([checkForUpdate(force), anyAgentWorking()]);
  return { info, busy };
}

/** How this Constella process runs (global / npx / dev / vps / portable) — drives the update method. */
export async function getUpdateContext(): Promise<string> {
  return detectRunContext();
}

/** Apply the update (mode-aware, backs up first). Auth-gated, and refused while an agent is actively working —
 *  a server restart would kill the running CLI mid-task. The UI also disables the button, but this guards
 *  against a stale client. */
export async function runUpdate(): Promise<UpdateResult> {
  await requireWorkspace();
  if (await anyAgentWorking()) {
    return { ok: false, started: false, blocked: true, context: "", command: "", message: "An agent is working — pause it before updating." };
  }
  return startUpdate();
}

/** Poll the background updater's result (after a global update was started). */
export async function pollUpdateResult(): Promise<ReturnType<typeof getUpdateResult>> {
  return getUpdateResult();
}
