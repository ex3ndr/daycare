import type { StorageDatabase } from "./databaseOpen.js";

/**
 * Closes an open storage database connection.
 */
export async function databaseClose(db: StorageDatabase): Promise<void> {
    await db.close();
}
