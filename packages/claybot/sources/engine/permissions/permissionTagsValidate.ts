import type { SessionPermissions } from "@/types";
import { permissionAccessAllows } from "./permissionAccessAllows.js";
import { permissionAccessParse } from "./permissionAccessParse.js";

/**
 * Validates that all permission tags are allowed by current permissions.
 * Throws an error if any permission is not already held by the caller.
 *
 * Expects: tags are @web, @read:<path>, or @write:<path>.
 */
export async function permissionTagsValidate(
  permissions: SessionPermissions,
  tags: string[]
): Promise<void> {
  for (const tag of tags) {
    const access = permissionAccessParse(tag);
    const allowed = await permissionAccessAllows(permissions, access);
    if (!allowed) {
      throw new Error(`Cannot attach permission '${tag}' - you don't have it.`);
    }
  }
}
