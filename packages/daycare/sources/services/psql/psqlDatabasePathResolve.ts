import path from "node:path";
import { UserHome } from "../../engine/users/userHome.js";

/**
 * Resolves the filesystem path for a user's scoped psql database directory.
 * Expects: dbId is already validated as non-empty.
 */
export function psqlDatabasePathResolve(usersDir: string, userId: string, dbId: string): string {
    const userHome = new UserHome(usersDir, userId);
    return path.join(userHome.databases, dbId);
}
