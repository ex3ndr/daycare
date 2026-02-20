import path from "node:path";

import type { SessionPermissions } from "@/types";
import { isWithinSecure } from "./pathResolveSecure.js";

/**
 * Resolves the shared workspace root path for a permission set.
 * Expects: permission paths are absolute and normalized.
 */
export function permissionWorkspacePathResolve(permissions: SessionPermissions): string {
    if (typeof permissions.workspaceDir === "string" && permissions.workspaceDir.trim().length > 0) {
        return path.resolve(permissions.workspaceDir);
    }

    const appWorkspace = appWorkspacePathResolve(permissions.workingDir);
    if (appWorkspace) {
        return appWorkspace;
    }

    const workingDir = path.resolve(permissions.workingDir);
    const candidates = Array.from(
        new Set([...permissions.readDirs, ...permissions.writeDirs].map((entry) => path.resolve(entry)))
    );
    const parentCandidates = candidates
        .filter((entry) => isWithinSecure(entry, workingDir))
        .sort((left, right) => right.length - left.length);
    return parentCandidates[0] ?? workingDir;
}

function appWorkspacePathResolve(workingDir: string): string | null {
    const resolved = path.resolve(workingDir);
    const segments = resolved.split(path.sep).filter((entry) => entry.length > 0);
    const root = path.parse(resolved).root;
    let workspaceSegments: string[] | null = null;
    for (let index = 0; index < segments.length; index += 1) {
        if (segments[index] !== "apps") {
            continue;
        }
        const marker = segments[index + 2];
        if (marker !== "data") {
            continue;
        }
        workspaceSegments = segments.slice(0, index);
    }
    if (!workspaceSegments) {
        return null;
    }
    return path.join(root, ...workspaceSegments);
}
