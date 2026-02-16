import { promises as fs } from "node:fs";
import path from "node:path";

import { getLogger } from "../../log.js";
import { appManifestParse } from "./appManifestParse.js";
import { appManifestValidate } from "./appManifestValidate.js";
import { appPermissionsParse } from "./appPermissionsParse.js";
import { appPermissionsValidate } from "./appPermissionsValidate.js";
import type { AppDescriptor } from "./appTypes.js";

const logger = getLogger("engine.apps.discover");

/**
 * Discovers installed apps from `<workspace>/apps/<app-id>/APP.md` and PERMISSIONS.md.
 * Expects: workspaceDir is an absolute workspace path.
 */
export async function appDiscover(workspaceDir: string): Promise<AppDescriptor[]> {
  const appsRoot = path.join(path.resolve(workspaceDir), "apps");
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(appsRoot, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }
    throw error;
  }

  const descriptors: AppDescriptor[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const appPath = path.join(appsRoot, entry.name);
    const manifestPath = path.join(appPath, "APP.md");
    const permissionsPath = path.join(appPath, "PERMISSIONS.md");
    let content = "";
    try {
      content = await fs.readFile(manifestPath, "utf8");
    } catch (error) {
      logger.warn({ appId: entry.name, path: manifestPath, error }, "skip: App missing APP.md");
      continue;
    }
    let permissionsContent = "";
    try {
      permissionsContent = await fs.readFile(permissionsPath, "utf8");
    } catch (error) {
      logger.warn({ appId: entry.name, path: permissionsPath, error }, "skip: App missing PERMISSIONS.md");
      continue;
    }

    try {
      const manifest = appManifestValidate(appManifestParse(content));
      const permissions = appPermissionsValidate(appPermissionsParse(permissionsContent));
      descriptors.push({
        id: manifest.name,
        path: appPath,
        manifest,
        permissions
      });
    } catch (error) {
      logger.warn(
        { appId: entry.name, manifestPath, permissionsPath, error },
        "skip: Invalid app metadata"
      );
    }
  }

  descriptors.sort((left, right) => left.id.localeCompare(right.id));
  return descriptors;
}
