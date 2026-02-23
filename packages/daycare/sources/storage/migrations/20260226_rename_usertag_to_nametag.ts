import type { Migration } from "./migrationTypes.js";

/**
 * Renames the users.usertag column to users.nametag and recreates indexes/triggers.
 * Expects: users table with usertag column from prior migrations.
 */
export const migration20260226RenameUsertagToNametag: Migration = {
    name: "20260226_rename_usertag_to_nametag",
    up(db): void {
        const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        if (userColumns.length === 0) {
            return;
        }

        const hasUsertag = userColumns.some((column) => column.name === "usertag");
        const hasNametag = userColumns.some((column) => column.name === "nametag");

        if (hasUsertag && !hasNametag) {
            db.exec("ALTER TABLE users RENAME COLUMN usertag TO nametag");
        }

        // Drop old indexes (may not exist on fresh DBs that already have nametag)
        db.exec("DROP INDEX IF EXISTS idx_users_usertag");
        db.exec("DROP INDEX IF EXISTS idx_users_usertag_required");

        // Create new indexes
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nametag ON users(nametag) WHERE nametag IS NOT NULL");
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nametag_required ON users(nametag)");

        // Drop old triggers
        db.exec("DROP TRIGGER IF EXISTS trg_users_usertag_required_insert");
        db.exec("DROP TRIGGER IF EXISTS trg_users_usertag_required_update");

        // Create new triggers referencing nametag
        db.exec(`
            CREATE TRIGGER IF NOT EXISTS trg_users_nametag_required_insert
            BEFORE INSERT ON users
            FOR EACH ROW
            WHEN NEW.nametag IS NULL OR trim(NEW.nametag) = ''
            BEGIN
                SELECT RAISE(ABORT, 'users.nametag is required');
            END;
        `);

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS trg_users_nametag_required_update
            BEFORE UPDATE OF nametag ON users
            FOR EACH ROW
            WHEN NEW.nametag IS NULL OR trim(NEW.nametag) = ''
            BEGIN
                SELECT RAISE(ABORT, 'users.nametag is required');
            END;
        `);
    }
};
