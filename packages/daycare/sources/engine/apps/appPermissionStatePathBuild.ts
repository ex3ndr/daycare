import path from "node:path";

/**
 * Builds the app permission state file path under the app workspace.
 * Expects: workspaceDir is absolute; appId is a validated app id.
 */
export function appPermissionStatePathBuild(workspaceDir: string, appId: string): string {
    return path.join(path.resolve(workspaceDir), "apps", appId, "state.json");
}
