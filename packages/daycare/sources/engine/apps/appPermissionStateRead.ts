import { promises as fs } from "node:fs";

import { z } from "zod";

import { permissionAccessParse } from "../permissions/permissionAccessParse.js";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import { appPermissionStatePathBuild } from "./appPermissionStatePathBuild.js";

const appPermissionStateSchema = z
  .object({
    permissions: z.array(z.string().min(1)).optional(),
    updatedAt: z.number().int().optional()
  })
  .strip();

/**
 * Reads shared app permission tags from app workspace state.
 * Expects: workspaceDir is absolute; appId is a validated app id.
 */
export async function appPermissionStateRead(workspaceDir: string, appId: string): Promise<string[]> {
  const filePath = appPermissionStatePathBuild(workspaceDir, appId);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsed = appPermissionStateSchema.parse(JSON.parse(raw) as unknown);
  const next = new Set<string>();
  for (const permission of parsed.permissions ?? []) {
    try {
      next.add(permissionFormatTag(permissionAccessParse(permission)));
    } catch {
      // Skip invalid persisted tags to keep startup resilient.
    }
  }
  return [...next];
}
