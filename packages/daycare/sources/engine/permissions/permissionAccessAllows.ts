import path from "node:path";

import type { PermissionAccess, SessionPermissions } from "@/types";
import { pathResolveSecure } from "./pathResolveSecure.js";
import { pathSanitizeAndResolve } from "./pathSanitize.js";

/**
 * Checks whether a permission access is already allowed by current permissions.
 * Expects: access.kind is web/read/write; paths must be absolute.
 */
export async function permissionAccessAllows(
  permissions: SessionPermissions,
  access: PermissionAccess
): Promise<boolean> {
  if (access.kind === "web") {
    return permissions.web;
  }

  if (!path.isAbsolute(access.path)) {
    return false;
  }

  let resolved: string;
  try {
    resolved = pathSanitizeAndResolve(access.path);
  } catch {
    return false;
  }

  const allowedDirs = access.kind === "write"
    ? [permissions.workingDir, ...permissions.writeDirs]
    : [permissions.workingDir, ...permissions.readDirs, ...permissions.writeDirs];

  try {
    await pathResolveSecure(allowedDirs, resolved);
    return true;
  } catch {
    return false;
  }
}
