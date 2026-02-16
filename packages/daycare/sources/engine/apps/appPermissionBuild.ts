import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { permissionAccessApply } from "../permissions/permissionAccessApply.js";
import { permissionAccessParse } from "../permissions/permissionAccessParse.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";

/**
 * Builds locked-down session permissions for an app agent.
 * Expects: workspaceDir is absolute; appId is a validated app id.
 */
export async function appPermissionBuild(
  workspaceDir: string,
  appId: string
): Promise<SessionPermissions> {
  const resolvedWorkspace = path.resolve(workspaceDir);
  const appDataDir = path.join(resolvedWorkspace, "apps", appId, "data");
  await fs.mkdir(appDataDir, { recursive: true });

  const permissions: SessionPermissions = {
    workingDir: appDataDir,
    writeDirs: [appDataDir],
    readDirs: [resolvedWorkspace],
    network: false,
    events: false
  };

  const sharedPermissions = await appPermissionStateRead(resolvedWorkspace, appId);
  for (const permission of sharedPermissions) {
    permissionAccessApply(permissions, permissionAccessParse(permission));
  }

  return permissions;
}
