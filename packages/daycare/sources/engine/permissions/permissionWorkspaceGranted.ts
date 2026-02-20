import path from "node:path";

import type { SessionPermissions } from "@/types";
import { isWithinSecure } from "./pathResolveSecure.js";
import { permissionWorkspacePathResolve } from "./permissionWorkspacePathResolve.js";

/**
 * Checks whether @workspace access is currently granted.
 * Expects: permissions are normalized absolute paths.
 */
export function permissionWorkspaceGranted(permissions: SessionPermissions): boolean {
    const workspacePath = permissionWorkspacePathResolve(permissions);
    return permissions.writeDirs.some((entry) => isWithinSecure(path.resolve(entry), workspacePath));
}
