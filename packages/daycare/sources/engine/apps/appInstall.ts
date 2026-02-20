import { promises as fs } from "node:fs";
import path from "node:path";

import { appManifestParse } from "./appManifestParse.js";
import { appManifestValidate } from "./appManifestValidate.js";
import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import type { AppDescriptor } from "./appTypes.js";

/**
 * Installs an app from a source directory into `<workspace>/apps/<app-id>`.
 * Expects: sourceDir contains APP.md + PERMISSIONS.md and destination app name does not exist.
 */
export async function appInstall(workspaceDir: string, sourceDir: string): Promise<AppDescriptor> {
    const resolvedWorkspace = path.resolve(workspaceDir);
    const resolvedSource = path.resolve(sourceDir);
    const sourceStat = await fs.stat(resolvedSource).catch(() => null);
    if (!sourceStat?.isDirectory()) {
        throw new Error(`App source directory not found: ${resolvedSource}`);
    }

    const sourceManifestPath = path.join(resolvedSource, "APP.md");
    const sourceContent = await fs.readFile(sourceManifestPath, "utf8").catch(() => null);
    if (sourceContent === null) {
        throw new Error(`App source is missing APP.md: ${sourceManifestPath}`);
    }
    const sourceManifest = appManifestValidate(appManifestParse(sourceContent));
    const sourcePermissionsPath = path.join(resolvedSource, "PERMISSIONS.md");
    const sourcePermissionsContent = await fs.readFile(sourcePermissionsPath, "utf8").catch(() => null);
    if (sourcePermissionsContent === null) {
        throw new Error(`App source is missing PERMISSIONS.md: ${sourcePermissionsPath}`);
    }
    appPermissionsValidate(appPermissionsParse(sourcePermissionsContent));

    const appsRoot = path.join(resolvedWorkspace, "apps");
    const destinationPath = path.join(appsRoot, sourceManifest.name);
    const destinationStat = await fs.stat(destinationPath).catch(() => null);
    if (destinationStat) {
        throw new Error(`App already installed: ${sourceManifest.name}`);
    }

    await fs.mkdir(appsRoot, { recursive: true });
    await fs.cp(resolvedSource, destinationPath, { recursive: true, force: false, errorOnExist: true });
    await fs.mkdir(path.join(destinationPath, "data"), { recursive: true });

    const copiedManifestPath = path.join(destinationPath, "APP.md");
    const copiedManifestContent = await fs.readFile(copiedManifestPath, "utf8");
    const copiedManifest = appManifestValidate(appManifestParse(copiedManifestContent));
    const copiedPermissionsPath = path.join(destinationPath, "PERMISSIONS.md");
    const copiedPermissionsContent = await fs.readFile(copiedPermissionsPath, "utf8");
    const copiedPermissions = appPermissionsValidate(appPermissionsParse(copiedPermissionsContent));
    return {
        id: copiedManifest.name,
        path: destinationPath,
        manifest: copiedManifest,
        permissions: copiedPermissions
    };
}
