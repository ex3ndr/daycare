import type { Migration } from "./migrationTypes.js";

/**
 * Adds the system_prompts table for configurable system/first-message prompts.
 * Supports global and per-user scoping with optional user-state conditions.
 */
export const migration20260224AddSystemPrompts: Migration = {
    name: "20260224_add_system_prompts",
    up(db): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS system_prompts (
                id TEXT PRIMARY KEY,
                scope TEXT NOT NULL,
                user_id TEXT,
                kind TEXT NOT NULL,
                condition TEXT,
                prompt TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_system_prompts_scope ON system_prompts(scope)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_system_prompts_user_id ON system_prompts(user_id)");
    }
};
