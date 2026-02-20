import fs from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { isWithinSecure } from "../engine/permissions/pathResolveSecure.js";

type SandboxAppsAccessCheckResult = {
    allowed: boolean;
    reason?: string;
};

/**
 * Checks whether a target path should be accessible under app isolation rules.
 * Expects: target is an absolute path.
 */
export function sandboxAppsAccessCheck(permissions: SessionPermissions, target: string): SandboxAppsAccessCheckResult {
    const resolvedTarget = sandboxExistingPathResolve(target);
    const appsRoot = sandboxAppsRootResolve(permissions, resolvedTarget);
    if (!appsRoot || !isWithinSecure(appsRoot, resolvedTarget)) {
        return { allowed: true };
    }

    const appId = sandboxAppIdFromWorkingDir(permissions.workingDir, appsRoot);
    if (!appId) {
        return { allowed: false, reason: "App directories are not accessible from non-app agents." };
    }
    const ownAppRoot = path.join(appsRoot, appId);
    if (!isWithinSecure(ownAppRoot, resolvedTarget)) {
        return { allowed: false, reason: "App agents can only access their own app directory." };
    }
    return { allowed: true };
}

function sandboxAppsRootResolve(permissions: SessionPermissions, target: string): string | null {
    const candidates = Array.from(
        new Set([permissions.workingDir, ...permissions.readDirs].map((entry) => sandboxExistingPathResolve(entry)))
    );
    for (const candidate of candidates) {
        const appsRoot = sandboxExistingPathResolve(path.resolve(candidate, "apps"));
        if (
            isWithinSecure(appsRoot, target) ||
            isWithinSecure(appsRoot, sandboxExistingPathResolve(permissions.workingDir))
        ) {
            return appsRoot;
        }
    }
    return null;
}

function sandboxAppIdFromWorkingDir(workingDir: string, appsRoot: string): string | null {
    const relative = path.relative(appsRoot, sandboxExistingPathResolve(workingDir));
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }
    const segments = relative.split(path.sep).filter((entry) => entry.length > 0);
    if (segments.length < 2) {
        return null;
    }
    if (segments[1] !== "data") {
        return null;
    }
    return segments[0] ?? null;
}

function sandboxExistingPathResolve(target: string): string {
    const resolved = path.resolve(target);
    try {
        return fs.realpathSync(resolved);
    } catch {
        return resolved;
    }
}
