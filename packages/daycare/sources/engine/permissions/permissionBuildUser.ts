import path from "node:path";

import type { SessionPermissions } from "@/types";
import type { UserHome } from "../users/userHome.js";

/**
 * Builds per-user default permissions scoped to one UserHome tree.
 * Expects: userHome points to an initialized users/<id> directory.
 */
export function permissionBuildUser(userHome: UserHome): SessionPermissions {
    const usersDir = path.dirname(userHome.root);
    const configDir = path.basename(usersDir) === "users" ? path.dirname(usersDir) : usersDir;
    return {
        workingDir: userHome.desktop,
        writeDirs: [userHome.home],
        readDirs: [userHome.skills, path.join(configDir, "skills")]
    };
}
