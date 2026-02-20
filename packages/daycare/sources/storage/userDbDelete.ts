import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";

/**
 * Deletes one user row by id.
 * Expects: caller handles referential effects (connector keys cascade on delete).
 */
export async function userDbDelete(config: Config, userId: string): Promise<void> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    } finally {
        db.close();
    }
}
