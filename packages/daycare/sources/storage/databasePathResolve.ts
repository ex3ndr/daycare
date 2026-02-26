import type { StorageDatabase } from "./databaseOpen.js";

/**
 * Resolves the absolute database file path for the main SQLite schema.
 * Expects: db is an open sqlite connection.
 */
export function databasePathResolve(db: Pick<StorageDatabase, "prepare">): string | null {
    const virtualPath = (db as StorageDatabase & { __daycareDatabasePath?: string }).__daycareDatabasePath;
    if (typeof virtualPath === "string" && virtualPath.trim().length > 0) {
        return virtualPath;
    }

    const rows = db.prepare("PRAGMA database_list").all() as Array<{ name?: string; file?: string }>;
    const main = rows.find((row) => row.name === "main") ?? rows[0];
    const file = main?.file?.trim() ?? "";
    return file.length > 0 ? file : null;
}
