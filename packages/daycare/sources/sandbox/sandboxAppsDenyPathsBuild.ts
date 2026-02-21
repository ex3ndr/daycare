import fs from "node:fs";
import path from "node:path";

/**
 * Builds app-directory deny paths for sandbox runtime policies.
 * Expects: permissions.workingDir is absolute and normalized.
 */
export function sandboxAppsDenyPathsBuild(permissions: { workingDir: string }): string[] {
    const context = sandboxAppsContextResolve(permissions.workingDir);
    if (!context) {
        return [path.resolve(permissions.workingDir, "apps")];
    }

    let entries: Array<fs.Dirent> = [];
    try {
        entries = fs.readdirSync(context.appsRoot, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory() && entry.name !== context.appId)
        .map((entry) => path.join(context.appsRoot, entry.name));
}

function sandboxAppsContextResolve(workingDir: string): { appsRoot: string; appId: string } | null {
    const resolved = path.resolve(workingDir);
    const segments = resolved.split(path.sep).filter((entry) => entry.length > 0);
    for (let index = 0; index < segments.length; index += 1) {
        if (segments[index] !== "apps") {
            continue;
        }
        const appId = segments[index + 1];
        const marker = segments[index + 2];
        if (!appId || marker !== "data") {
            continue;
        }
        const rootSegments = segments.slice(0, index);
        const workspaceRoot = path.join(path.parse(resolved).root, ...rootSegments);
        return {
            appsRoot: path.join(workspaceRoot, "apps"),
            appId
        };
    }
    return null;
}
