import type { SessionPermissions } from "@/types";

import { permissionBuildCron } from "./permissionBuildCron.js";

/**
 * Builds cron base permissions and carries forward runtime-granted permissions.
 * Expects: filesPath is the cron workspace path; current permissions are normalized.
 */
export function permissionBuildCronSession(
  currentPermissions: SessionPermissions,
  defaultPermissions: SessionPermissions,
  filesPath: string
): SessionPermissions {
  const cronPermissions = permissionBuildCron(defaultPermissions, filesPath);
  const writeDirs = new Set([...cronPermissions.writeDirs, ...currentPermissions.writeDirs]);
  const readDirs = new Set([...cronPermissions.readDirs, ...currentPermissions.readDirs]);

  return {
    ...cronPermissions,
    writeDirs: Array.from(writeDirs.values()),
    readDirs: Array.from(readDirs.values()),
    network: cronPermissions.network || currentPermissions.network,
    events: cronPermissions.events || currentPermissions.events
  };
}
