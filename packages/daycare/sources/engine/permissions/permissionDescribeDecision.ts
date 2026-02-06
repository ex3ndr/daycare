import type { PermissionAccess } from "@/types";

export function permissionDescribeDecision(access: PermissionAccess): string {
  if (access.kind === "network") {
    return "network access";
  }
  if (access.kind === "read") {
    return `read access to ${access.path}`;
  }
  return `write access to ${access.path}`;
}
