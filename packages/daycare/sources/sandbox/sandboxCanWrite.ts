import type { SessionPermissions } from "@/types";
import { pathResolveSecure } from "../engine/permissions/pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";

/**
 * Resolves a write target against the current write allowlist.
 * Expects: target is an absolute path.
 */
export async function sandboxCanWrite(permissions: SessionPermissions, target: string): Promise<string> {
    const allowedDirs = [...permissions.writeDirs];
    const result = await pathResolveSecure(allowedDirs, target);
    const access = sandboxAppsAccessCheck(permissions, result.realPath);
    if (!access.allowed) {
        throw new Error(access.reason ?? "Write access denied.");
    }
    return result.realPath;
}
