import type { StorageDatabase } from "./databaseOpen.js";

/**
 * Resolves the absolute database storage path for file-backed databases.
 * Expects: db is an open storage database connection.
 */
export function databasePathResolve(db: StorageDatabase): string | null {
    const virtualPath = db.__daycareDatabasePath;
    if (typeof virtualPath !== "string") {
        return null;
    }

    const trimmed = virtualPath.trim();
    return trimmed.length > 0 ? trimmed : null;
}
