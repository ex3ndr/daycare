import type { Migration } from "./migrationTypes.js";

/**
 * Adds memory processing columns to the sessions table.
 * invalidated_at: session_history.id of the last record at invalidation time.
 * processed_until: session_history.id of the last processed record.
 */
export const migration20260224AddMemoryColumns: Migration = {
    name: "20260224_add_memory_columns",
    up(db): void {
        const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
        if (columns.length === 0) {
            return;
        }

        const hasInvalidatedAt = columns.some((column) => column.name === "invalidated_at");
        if (!hasInvalidatedAt) {
            db.exec("ALTER TABLE sessions ADD COLUMN invalidated_at INTEGER");
        }

        const hasProcessedUntil = columns.some((column) => column.name === "processed_until");
        if (!hasProcessedUntil) {
            db.exec("ALTER TABLE sessions ADD COLUMN processed_until INTEGER");
        }

        db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_invalidated_at ON sessions(invalidated_at)");
    }
};
