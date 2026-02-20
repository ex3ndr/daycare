import type { SessionPermissions } from "../permissions.js";

export function permissionEnsureDefaultFile(
    permissions: SessionPermissions,
    defaults: Pick<SessionPermissions, "writeDirs" | "readDirs">
): void {
    const nextWrite = new Set([...permissions.writeDirs, ...defaults.writeDirs]);
    const nextRead = new Set([...permissions.readDirs, ...defaults.readDirs]);
    permissions.writeDirs = Array.from(nextWrite.values());
    permissions.readDirs = Array.from(nextRead.values());
}
