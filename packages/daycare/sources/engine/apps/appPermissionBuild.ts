import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";

/**
 * Builds locked-down session permissions for an app agent.
 * Expects: appsDir is absolute; appId is a validated app id.
 */
export async function appPermissionBuild(appsDir: string, appId: string): Promise<SessionPermissions> {
    const resolvedAppsDir = path.resolve(appsDir);
    const appDataDir = path.join(resolvedAppsDir, appId, "data");
    await fs.mkdir(appDataDir, { recursive: true });

    return {
        workingDir: appDataDir,
        writeDirs: [appDataDir]
    };
}
