import type { SessionPermissions } from "@/types";
import { pathResolveSecure } from "./pathResolveSecure.js";
import { sandboxAppsAccessCheck } from "./sandboxAppsAccessCheck.js";
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

    // Keep write behavior aligned with sandbox-runtime deny protections.
    if (sandboxPathDenyCheck(result.realPath, sandboxSensitiveDenyPathsBuild())) {
        throw new Error("Write access denied for sensitive paths.");
    }

    if (sandboxDangerousFileCheck(result.realPath, sandboxDangerousFilesBuild())) {
        throw new Error("Write access denied for dangerous files or directories.");
    }

    return result.realPath;
}
