import path from "node:path";

import type { PermissionAccess, SessionPermissions } from "@/types";
import { pathResolveSecure } from "./pathResolveSecure.js";
import { pathSanitizeAndResolve } from "./pathSanitize.js";
import { permissionWorkspacePathResolve } from "./permissionWorkspacePathResolve.js";

/**
 * Checks whether a permission access is already allowed by current permissions.
 * Expects: access.kind is network/events/workspace/read/write; paths must be absolute for read/write.
 */
export async function permissionAccessAllows(
    permissions: SessionPermissions,
    access: PermissionAccess
): Promise<boolean> {
    if (access.kind === "network") {
        return permissions.network;
    }
    if (access.kind === "events") {
        return permissions.events;
    }
    if (access.kind === "workspace") {
        const workspacePath = permissionWorkspacePathResolve(permissions);
        try {
            await pathResolveSecure(permissions.writeDirs, workspacePath);
            return true;
        } catch {
            return false;
        }
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

    if (
        access.kind === "write" &&
        permissionIsProtectedAppPolicyPath(resolved) &&
        !permissionHasExplicitFileWriteGrant(permissions, resolved)
    ) {
        return false;
    }

    const allowedDirs =
        access.kind === "write"
            ? [...permissions.writeDirs]
            : permissions.readDirs.length > 0
              ? [permissions.workingDir, ...permissions.readDirs, ...permissions.writeDirs]
              : [path.parse(resolved).root];

    try {
        await pathResolveSecure(allowedDirs, resolved);
        return true;
    } catch {
        return false;
    }
}

function permissionIsProtectedAppPolicyPath(target: string): boolean {
    const baseName = path.basename(target);
    if (baseName !== "APP.md" && baseName !== "PERMISSIONS.md") {
        return false;
    }
    const appDir = path.dirname(target);
    const appsDir = path.dirname(appDir);
    return path.basename(appsDir) === "apps";
}

function permissionHasExplicitFileWriteGrant(permissions: SessionPermissions, target: string): boolean {
    const resolvedTarget = path.resolve(target);
    for (const entry of permissions.writeDirs) {
        if (path.resolve(entry) === resolvedTarget) {
            return true;
        }
    }
    return false;
}
