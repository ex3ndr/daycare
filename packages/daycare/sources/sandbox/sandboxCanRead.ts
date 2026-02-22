import path from "node:path";

import type { SessionPermissions } from "@/types";
import { pathResolveSecure } from "../engine/permissions/pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";

/**
 * Resolves a read target against the current read allowlist.
 * Expects: target is an absolute path.
 */
export async function sandboxCanRead(
  permissions: SessionPermissions,
  target: string
): Promise<string> {
  // Build allowlist from permissions
  const allowedDirs = [
    permissions.workspaceDir ?? permissions.workingDir,
    ...permissions.readDirs,
    ...permissions.writeDirs
  ].filter(Boolean);
  
  // If no allowedDirs configured, use legacy behavior (allow all)
  if (allowedDirs.length === 0) {
    allowedDirs.push(path.parse(target).root);
  }
  
  const result = await pathResolveSecure(allowedDirs, target);
  const access = sandboxAppsAccessCheck(permissions, result.realPath);
  if (\!access.allowed) {
    throw new Error(access.reason ?? "Read access denied.");
  }
  return result.realPath;
}

