import type { SessionPermissions } from "@/types";
import { permissionAccessApply } from "./permissionAccessApply.js";
import { permissionAccessParse } from "./permissionAccessParse.js";

/**
 * Applies permission tags to a permissions object.
 * Expects: tags are @web, @read:<path>, or @write:<path>.
 */
export function permissionTagsApply(
  permissions: SessionPermissions,
  tags: string[]
): void {
  for (const tag of tags) {
    const access = permissionAccessParse(tag);
    const applied = permissionAccessApply(permissions, access);
    if (!applied) {
      throw new Error(`Invalid permission tag: ${tag}`);
    }
  }
}
