"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { writeWorkspaceFile, deleteWorkspacePath, listFiles, readWorkspaceFile } from "@/lib/fs-workspace";
import { langOf } from "@/lib/lang";

export async function createFile(path: string) {
  const { org } = await requireWorkspace();
  const clean = path.trim().replace(/^\/+/, "");
  if (!clean) return;
  writeWorkspaceFile(org.id, clean, "// " + clean + "\n");
  revalidatePath("/code");
}

export async function createFolder(path: string) {
  const { org } = await requireWorkspace();
  const clean = path.trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return;
  // A folder exists on disk once it has content; .gitkeep keeps it tracked + non-empty.
  writeWorkspaceFile(org.id, clean + "/.gitkeep", "");
  revalidatePath("/code");
}

export async function saveFileContent(path: string, content: string) {
  const { org } = await requireWorkspace();
  writeWorkspaceFile(org.id, path, content);
  revalidatePath("/code");
}

export async function deleteFile(path: string) {
  const { org } = await requireWorkspace();
  deleteWorkspacePath(org.id, path);
  revalidatePath("/code");
}

/** Read the whole workspace tree from disk for the editor. */
export async function readWorkspace() {
  const { org } = await requireWorkspace();
  return listFiles(org.id).map((p) => ({
    path: p, lang: langOf(p), content: readWorkspaceFile(org.id, p) ?? "",
  }));
}
