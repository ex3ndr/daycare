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
    const requestedPath = path.resolve(target);
    const allowedDirs = [...permissions.writeDirs];
    const result = await pathResolveSecure(allowedDirs, requestedPath).catch((error: unknown) => {
        if (error instanceof Error && error.message === "Path is outside the allowed directories.") {
            throw writePermissionDeniedError(requestedPath);
        }
        throw error;
    });
    const access = sandboxAppsAccessCheck(permissions, result.realPath);
    if (!access.allowed) {
        throw writePermissionDeniedError(requestedPath);
    }

    // Require readability of the target (or nearest existing parent) before writes.
    const readCheckTarget = await writableReadCheckTargetResolve(result.realPath);
    try {
        await sandboxCanRead(permissions, readCheckTarget);
    } catch (error) {
        if (isReadPermissionDeniedError(error)) {
            throw writePermissionDeniedError(requestedPath);
        }
        throw error;
    }

    // Keep write behavior aligned with sandbox-runtime deny protections.
    if (sandboxPathDenyCheck(result.realPath, sandboxSensitiveDenyPathsBuild())) {
        throw writePermissionDeniedError(requestedPath);
    }

    if (sandboxDangerousFileCheck(result.realPath, sandboxDangerousFilesBuild())) {
        throw writePermissionDeniedError(requestedPath);
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

function writePermissionDeniedError(target: string): Error {
    return new Error(`Write permission denied: ${target}`);
}

function isReadPermissionDeniedError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith("Read permission denied:");
}
