"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { ChatDock } from "@/components/shell/chat-dock";

// The Welcome Home (`/`) hosts its OWN central, fixed chat — so the floating dock, its FAB button and
// the side bubble must not appear there (no two concurrent chats on one screen). Everywhere else the
// dock works normally and keeps its context.
export function ChatDockGate(props: ComponentProps<typeof ChatDock>) {
  const path = usePathname();
  if (path === "/") return null;
  return <ChatDock {...props} />;
}
