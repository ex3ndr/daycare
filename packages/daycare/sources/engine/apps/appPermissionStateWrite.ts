import { promises as fs } from "node:fs";
import path from "node:path";
import { atomicWrite } from "../../util/atomicWrite.js";
import { permissionAccessParse } from "../permissions/permissionAccessParse.js";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import { appPermissionStatePathBuild } from "./appPermissionStatePathBuild.js";

/**
 * Persists shared app permission tags to app workspace state.
 * Expects: permission tags are parseable by permissionAccessParse.
 */
export async function appPermissionStateWrite(
    workspaceDir: string,
    appId: string,
    permissions: string[]
): Promise<void> {
    const filePath = appPermissionStatePathBuild(workspaceDir, appId);
    const normalized = permissionTagsNormalize(permissions);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = `${JSON.stringify(
        {
            permissions: normalized,
            updatedAt: Date.now()
        },
        null,
        2
    )}\n`;
    await atomicWrite(filePath, payload);
}

function permissionTagsNormalize(permissions: string[]): string[] {
    const next = new Set<string>();
    for (const permission of permissions) {
        const trimmed = permission.trim();
        if (!trimmed) {
            continue;
        }
        next.add(permissionFormatTag(permissionAccessParse(trimmed)));
    }
    return [...next];
}
