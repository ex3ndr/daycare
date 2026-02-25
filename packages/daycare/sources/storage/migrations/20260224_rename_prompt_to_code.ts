import type { Migration } from "./migrationTypes.js";

/**
 * Renames the prompt column to code in tasks_heartbeat and tasks_cron.
 * Expects: tables exist from prior migrations.
 */
export const migration20260224RenamePromptToCode: Migration = {
    name: "20260224_rename_prompt_to_code",
    up(db): void {
        const heartbeatCols = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
        if (heartbeatCols.some((c) => c.name === "prompt") && !heartbeatCols.some((c) => c.name === "code")) {
            db.exec("ALTER TABLE tasks_heartbeat RENAME COLUMN prompt TO code");
        }

        const cronCols = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
        if (cronCols.some((c) => c.name === "prompt") && !cronCols.some((c) => c.name === "code")) {
            db.exec("ALTER TABLE tasks_cron RENAME COLUMN prompt TO code");
        }
    }
};
