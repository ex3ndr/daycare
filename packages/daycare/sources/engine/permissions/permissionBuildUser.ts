import type { SessionPermissions } from "@/types";
import type { UserHome } from "../users/userHome.js";

/**
 * Builds per-user default permissions scoped to one UserHome tree.
 * Expects: userHome points to an initialized users/<id> directory.
 */
export function permissionBuildUser(userHome: UserHome): SessionPermissions {
    const knowledgePaths = userHome.knowledgePaths();
    const writeDirs = [
        userHome.desktop,
        userHome.downloads,
        userHome.documents,
        userHome.developer,
        userHome.tmp,
        knowledgePaths.soulPath,
        knowledgePaths.userPath,
        knowledgePaths.agentsPath,
        knowledgePaths.toolsPath
    ];
    const readDirs = [...writeDirs, userHome.skills];
    return {
        workspaceDir: userHome.home,
        workingDir: userHome.desktop,
        writeDirs: Array.from(new Set(writeDirs)),
        readDirs: Array.from(new Set(readDirs)),
        network: false,
        events: false
    };
}
