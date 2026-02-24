import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { isWithinSecure, pathResolveSecure } from "./pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";
import { sandboxPathDenyCheck } from "./sandboxPathDenyCheck.js";
import { sandboxReadBoundaryDenyPathsBuild } from "./sandboxReadBoundaryDenyPathsBuild.js";
import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

/**
 * Resolves a read target against the current read allowlist.
 * Expects: target is an absolute path.
 */
export async function sandboxCanRead(permissions: SessionPermissions, target: string): Promise<string> {
    const requestedPath = path.resolve(target);
    // Read uses a broad allowlist, then applies hard deny-lists.
    const allowedDirs = [path.parse(requestedPath).root];
    const result = await pathResolveSecure(allowedDirs, requestedPath);
    const access = sandboxAppsAccessCheck(permissions, result.realPath);
    if (!access.allowed) {
        throw readPermissionDeniedError(requestedPath);
    }

    if (sandboxPathDenyCheck(result.realPath, sandboxSensitiveDenyPathsBuild())) {
        throw readPermissionDeniedError(requestedPath);
    }

    const explicitlyAllowedDirs = [permissions.workingDir, ...(permissions.readDirs ?? [])];
    for (const allowedDir of explicitlyAllowedDirs) {
        if (isWithinSecure(await existingPathResolve(allowedDir), result.realPath)) {
            return result.realPath;
        }
    }

    if (sandboxPathDenyCheck(result.realPath, sandboxReadBoundaryDenyPathsBuild())) {
        throw readPermissionDeniedError(requestedPath);
    }

    return result.realPath;
}

async function existingPathResolve(target: string): Promise<string> {
    try {
        return await fs.realpath(target);
    } catch {
        return path.resolve(target);
    }
}

function readPermissionDeniedError(target: string): Error {
    return new Error(`Read permission denied: ${target}`);
}
