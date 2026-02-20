import type { PermissionAccess } from "@/types";

export function permissionFormatTag(access: PermissionAccess): string {
    if (access.kind === "network") {
        return "@network";
    }
    if (access.kind === "events") {
        return "@events";
    }
    if (access.kind === "workspace") {
        return "@workspace";
    }
    return `@${access.kind}:${access.path}`;
}
