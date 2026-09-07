import "server-only";

export type DlProgress = { received: number; total: number; done: boolean; error?: string };

/**
 * In-flight download byte progress, keyed by GGUF catalog id (or "llama-server"). A process-singleton
 * map shared by the download server actions (which WRITE it) and the `/api/models/progress` route
 * (which the UI polls to READ it). It MUST live outside the "use server" module so the API route can
 * read it: Next.js serializes Server Actions, so a server-action poll queues behind the long-running
 * download action and never updates mid-download — an API route runs concurrently and reports live %.
 */
export const DL_PROGRESS = new Map<string, DlProgress>();
