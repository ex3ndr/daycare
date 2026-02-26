import type { StorageDatabase } from "./databaseOpen.js";

/**
 * Closes an open storage database connection.
 */
export function databaseClose(db: StorageDatabase): void {
    db.close();
}
