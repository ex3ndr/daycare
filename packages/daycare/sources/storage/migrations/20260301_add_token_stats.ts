import type { Migration } from "./migrationTypes.js";

/**
 * Adds hourly token usage rollups by user, agent, and model.
 * Expects: users and agents tables already exist.
 */
export const migration20260301AddTokenStats: Migration = {
    name: "20260301_add_token_stats",
    up(db): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS token_stats_hourly (
                hour_start INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                cost REAL NOT NULL DEFAULT 0,
                PRIMARY KEY (hour_start, user_id, agent_id, model),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_token_stats_hourly_hour_start ON token_stats_hourly(hour_start)");
        db.exec(
            "CREATE INDEX IF NOT EXISTS idx_token_stats_hourly_user_hour ON token_stats_hourly(user_id, hour_start)"
        );
        db.exec(
            "CREATE INDEX IF NOT EXISTS idx_token_stats_hourly_agent_hour ON token_stats_hourly(agent_id, hour_start)"
        );
    }
};
