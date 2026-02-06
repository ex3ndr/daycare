import { normalizePermissions, type SessionPermissions } from "../permissions.js";

import { permissionEnsureDefaultFile } from "./permissionEnsureDefaultFile.js";

export function permissionBuildCron(
  defaultPermissions: SessionPermissions,
  filesPath: string
): SessionPermissions {
  const permissions = normalizePermissions(
    {
      workingDir: filesPath,
      writeDirs: defaultPermissions.writeDirs,
      readDirs: defaultPermissions.readDirs,
      network: defaultPermissions.network
    },
    defaultPermissions.workingDir
  );
  permissionEnsureDefaultFile(permissions, defaultPermissions);
  return permissions;
}
