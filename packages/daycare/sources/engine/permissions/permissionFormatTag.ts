import type { PermissionAccess } from "@/types";

export function permissionFormatTag(access: PermissionAccess): string {
  if (access.kind === "network") {
    return "@network";
  }
  return `@${access.kind}:${access.path}`;
}
