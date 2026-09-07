import { NextResponse } from "next/server";
import { DL_PROGRESS } from "@/server/download-progress";

/**
 * Live download progress for the Models UI. A GET API route (NOT a server action) so it runs
 * CONCURRENTLY with the long-running download server action — server actions are serialized, so a
 * server-action poll would queue behind the download and the bar would never move until it finished.
 * Returns the byte counter for `?id=<gguf-id|llama-server>`, or null if nothing is in flight.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return NextResponse.json(id ? DL_PROGRESS.get(id) ?? null : null);
}
