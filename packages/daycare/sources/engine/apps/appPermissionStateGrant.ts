import type { PermissionAccess } from "@/types";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";
import { appPermissionStateWrite } from "./appPermissionStateWrite.js";

/**
 * Grants one shared permission tag for an app and persists it in app state.
 * Expects: workspaceDir/appId point to an installed app workspace.
 */
export async function appPermissionStateGrant(
  workspaceDir: string,
  appId: string,
  access: PermissionAccess
): Promise<string[]> {
  const current = await appPermissionStateRead(workspaceDir, appId);
  const next = Array.from(new Set([...current, permissionFormatTag(access)]));
  await appPermissionStateWrite(workspaceDir, appId, next);
  return next;
}
