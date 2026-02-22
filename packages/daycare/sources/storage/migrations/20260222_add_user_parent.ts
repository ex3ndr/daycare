import type { Migration } from "./migrationTypes.js";

/**
 * Adds parent_user_id and name columns to the users table for subuser isolation.
 * parent_user_id links a subuser to its owner; name is a display label.
 */
export const migration20260222AddUserParent: Migration = {
    name: "20260222_add_user_parent",
    up(db): void {
        const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        if (columns.length === 0) {
            return;
        }

        const hasParentUserId = columns.some((column) => column.name === "parent_user_id");
        if (!hasParentUserId) {
            db.exec("ALTER TABLE users ADD COLUMN parent_user_id TEXT REFERENCES users(id)");
        }

        const hasName = columns.some((column) => column.name === "name");
        if (!hasName) {
            db.exec("ALTER TABLE users ADD COLUMN name TEXT");
        }

        db.exec(
            "CREATE INDEX IF NOT EXISTS idx_users_parent ON users(parent_user_id) WHERE parent_user_id IS NOT NULL"
        );
    }
};
