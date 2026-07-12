import "server-only";
import { writeWorkspaceFile, deleteWorkspacePath } from "@/lib/fs-workspace";
import { indexFile, deindexFile } from "@/server/sync";

/**
 * Write-through document helper. The directory is the source of truth: write the
 * `.md` to disk, then mirror it into the DB index so the UI/search stay in sync
 * immediately (the watcher also catches external/agent edits as a backstop).
 */
export async function writeDoc(orgId: string, rel: string, content: string) {
  writeWorkspaceFile(orgId, rel, content);
  await indexFile(orgId, rel);
}

export async function removeDoc(orgId: string, rel: string) {
  deleteWorkspacePath(orgId, rel);
  await deindexFile(orgId, rel);
}
