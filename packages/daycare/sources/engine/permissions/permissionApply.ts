import path from "node:path";

import type { PermissionDecision } from "@/types";
import type { SessionPermissions } from "../permissions.js";
import { permissionAccessApply } from "./permissionAccessApply.js";

export function permissionApply(permissions: SessionPermissions, decision: PermissionDecision): void {
    if (!decision.approved) {
        return;
    }
    for (const permission of decision.permissions) {
        permissionAccessApply(permissions, permission.access);
    }
}
