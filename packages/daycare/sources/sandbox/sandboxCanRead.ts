import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { isWithinSecure, pathResolveSecure } from "./pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";
import { sandboxPathDenyCheck } from "./sandboxPathDenyCheck.js";
import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

/**
 * Resolves a read target against the current read allowlist.
 * Expects: target is an absolute path.
 */
export async function sandboxCanRead(permissions: SessionPermissions, target: string): Promise<string> {
    // Read uses a broad allowlist, then applies explicit deny-lists to match sandbox safety policy.
    const allowedDirs = [path.parse(target).root];
    const result = await pathResolveSecure(allowedDirs, target);
    const access = sandboxAppsAccessCheck(permissions, result.realPath);
    if (!access.allowed) {
        throw new Error(access.reason ?? "Read access denied.");
    }

    if (sandboxPathDenyCheck(result.realPath, sandboxSensitiveDenyPathsBuild())) {
        throw new Error("Read access denied for sensitive paths.");
    }

    const explicitlyAllowedDirs = [permissions.workingDir, ...permissions.writeDirs, ...(permissions.readDirs ?? [])];
    for (const allowedDir of explicitlyAllowedDirs) {
        if (isWithinSecure(await existingPathResolve(allowedDir), result.realPath)) {
            return result.realPath;
        }
    }

    if (isWithinSecure(await existingPathResolve(os.homedir()), result.realPath)) {
        throw new Error("Read access denied for OS home paths without explicit permission.");
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
