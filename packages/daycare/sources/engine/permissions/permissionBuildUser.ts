import type { SessionPermissions } from "@/types";
import type { UserHome } from "../users/userHome.js";

/**
 * Builds per-user default permissions scoped to one UserHome tree.
 * Expects: userHome points to an initialized users/<id> directory.
 */
export function permissionBuildUser(userHome: UserHome): SessionPermissions {
    return {
        workingDir: userHome.desktop,
        writeDirs: [userHome.home]
    };
}
