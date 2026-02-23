import type { Migration } from "./migrationTypes.js";

/**
 * Adds nullable usertag support to users and introduces canonical pair connections.
 * Expects: users table exists from previous migrations.
 */
export const migration20260222AddUsertagConnections: Migration = {
    name: "20260222_add_usertag_connections",
    up(db): void {
        const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        if (userColumns.length === 0) {
            return;
        }

        const hasUsertag = userColumns.some((column) => column.name === "usertag");
        if (!hasUsertag) {
            db.exec("ALTER TABLE users ADD COLUMN usertag TEXT");
        }

        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_usertag ON users(usertag) WHERE usertag IS NOT NULL");

        db.exec(`
            CREATE TABLE IF NOT EXISTS connections (
                user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                requested_a INTEGER NOT NULL DEFAULT 0,
                requested_b INTEGER NOT NULL DEFAULT 0,
                requested_a_at INTEGER,
                requested_b_at INTEGER,
                PRIMARY KEY (user_a_id, user_b_id),
                CHECK (user_a_id < user_b_id)
            );
        `);

        db.exec("CREATE INDEX IF NOT EXISTS idx_connections_user_b ON connections(user_b_id)");
    }
};
