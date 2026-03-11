import path from "node:path";
import { UserHome } from "../users/userHome.js";

/**
 * Resolves the filesystem directory for one mini-app code revision.
 * Expects: usersDir is absolute and userId/appId are stable ids.
 */
export function miniAppDirectoryResolve(usersDir: string, userId: string, appId: string, codeVersion: number): string {
    const userHome = new UserHome(usersDir, userId);
    return path.join(userHome.apps, appId, String(codeVersion));
}
