"use client";

import { DesignRoom, type DesignTokens } from "@/components/design/design-room";

type Ctx = {
  mission: string; objective: string; stackList: string; brief: boolean;
  mockCount: number; designMockFiles: string[]; designSkillCount: number;
  hasImported: boolean; approved: boolean; gatePending?: boolean; gateScaffolded?: boolean; handoffPending?: boolean; handoffDone?: boolean;
};

/** Design module entry — renders the room (chat with the frontend agent + canvas + rails). Thin client
 *  wrapper so the server page stays a pure data loader. */
export function DesignClient(props: {
  context: Ctx;
  grace: { id: string; name: string; handle: string; color: string; image?: string | null } | null;
  status: string;
  tokens: DesignTokens | null;
}) {
  return <DesignRoom grace={props.grace} context={props.context} status={props.status} tokens={props.tokens} />;
}
