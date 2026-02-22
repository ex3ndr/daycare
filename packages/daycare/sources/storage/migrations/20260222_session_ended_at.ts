import type { Migration } from "./migrationTypes.js";

/**
 * Adds ended_at column to the sessions table.
 * Allows consumers to distinguish active vs finished sessions.
 */
export const migration20260222SessionEndedAt: Migration = {
    name: "20260222_session_ended_at",
    up(db): void {
        const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
        if (columns.length === 0) {
            return;
        }

        const hasEndedAt = columns.some((column) => column.name === "ended_at");
        if (!hasEndedAt) {
            db.exec("ALTER TABLE sessions ADD COLUMN ended_at INTEGER");
        }
    }
};
