import type { Migration } from "./migrationTypes.js";

/**
 * Creates permission request persistence for pending and resolved decisions.
 * Expects: users and agents tables already exist for user_id/agent_id values.
 */
export const migration20260221AddPermissionRequests: Migration = {
    name: "20260221_add_permission_requests",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS permission_requests (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        permissions TEXT NOT NULL,
        reason TEXT NOT NULL,
        requester TEXT NOT NULL,
        scope TEXT,
        timeout_at INTEGER NOT NULL,
        decision TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_permission_requests_token
        ON permission_requests(token);
      CREATE INDEX IF NOT EXISTS idx_permission_requests_agent_id
        ON permission_requests(agent_id);
      CREATE INDEX IF NOT EXISTS idx_permission_requests_status
        ON permission_requests(status);
    `);
    }
};
