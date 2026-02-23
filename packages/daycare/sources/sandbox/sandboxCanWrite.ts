import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { pathResolveSecure } from "./pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";
import { sandboxCanRead } from "./sandboxCanRead.js";
import { sandboxDangerousFileCheck } from "./sandboxDangerousFileCheck.js";
import { sandboxDangerousFilesBuild } from "./sandboxDangerousFilesBuild.js";
import { sandboxPathDenyCheck } from "./sandboxPathDenyCheck.js";
import { sandboxSensitiveDenyPathsBuild } from "./sandboxSensitiveDenyPathsBuild.js";

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

    // Require readability of the target (or nearest existing parent) before writes.
    const readCheckTarget = await writableReadCheckTargetResolve(result.realPath);
    await sandboxCanRead(permissions, readCheckTarget);

    // Keep write behavior aligned with sandbox-runtime deny protections.
    if (sandboxPathDenyCheck(result.realPath, sandboxSensitiveDenyPathsBuild())) {
        throw new Error("Write access denied for sensitive paths.");
    }

    if (sandboxDangerousFileCheck(result.realPath, sandboxDangerousFilesBuild())) {
        throw new Error("Write access denied for dangerous files or directories.");
    }

    return result.realPath;
}

async function writableReadCheckTargetResolve(target: string): Promise<string> {
    let current = path.resolve(target);
    while (true) {
        try {
            await fs.access(current);
            return current;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }

        const parent = path.dirname(current);
        if (parent === current) {
            return current;
        }
        current = parent;
    }
}
