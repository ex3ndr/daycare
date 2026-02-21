import path from "node:path";

import type { SessionPermissions } from "@/types";
import { pathResolveSecure } from "./pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";

/**
 * Resolves a read target against the current read allowlist.
 * Expects: target is an absolute path.
 */
export async function sandboxCanRead(permissions: SessionPermissions, target: string): Promise<string> {
    // Tool-level reads are always allowed across the filesystem.
    const allowedDirs = [path.parse(target).root];
    const result = await pathResolveSecure(allowedDirs, target);
    const access = sandboxAppsAccessCheck(permissions, result.realPath);
    if (!access.allowed) {
        throw new Error(access.reason ?? "Read access denied.");
    }
    return result.realPath;
}
