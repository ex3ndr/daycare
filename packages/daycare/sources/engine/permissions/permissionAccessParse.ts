import type { PermissionAccess } from "@/types";

/**
 * Parses a permission tag string into a PermissionAccess union.
 * Expects: value is @network, @events, @workspace, @read:<path>, or @write:<path>.
 */
export function permissionAccessParse(value: string): PermissionAccess {
    const trimmed = value.trim();
    if (trimmed === "@network") {
        return { kind: "network" };
    }
    if (trimmed === "@events") {
        return { kind: "events" };
    }
    if (trimmed === "@workspace") {
        return { kind: "workspace" };
    }
    if (trimmed.startsWith("@read:")) {
        const pathValue = trimmed.slice("@read:".length).trim();
        if (!pathValue) {
            throw new Error("Read permission requires a path.");
        }
        return { kind: "read", path: pathValue };
    }
    if (trimmed.startsWith("@write:")) {
        const pathValue = trimmed.slice("@write:".length).trim();
        if (!pathValue) {
            throw new Error("Write permission requires a path.");
        }
        return { kind: "write", path: pathValue };
    }
    throw new Error("Permission must be @network, @events, @workspace, @read:<path>, or @write:<path>.");
}
