import { nametagGenerate } from "../../engine/friends/nametagGenerate.js";
import type { Migration } from "./migrationTypes.js";

/**
 * Backfills usertags for legacy users and enforces non-empty usertags at the DB layer.
 * Expects: users.usertag column already exists.
 */
export const migration20260225RequireUsertag: Migration = {
    name: "20260225_require_usertag",
    up(db): void {
        const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        if (userColumns.length === 0) {
            return;
        }
        const hasUsertag = userColumns.some((column) => column.name === "usertag");
        if (!hasUsertag) {
            return;
        }

        const existingTags = new Set(
            (
                db
                    .prepare("SELECT usertag FROM users WHERE usertag IS NOT NULL AND trim(usertag) <> ''")
                    .all() as Array<{
                    usertag: string;
                }>
            ).map((row) => row.usertag)
        );
        const usersMissingTags = db
            .prepare("SELECT id FROM users WHERE usertag IS NULL OR trim(usertag) = '' ORDER BY created_at ASC, id ASC")
            .all() as Array<{ id: string }>;

        for (const user of usersMissingTags) {
            let nextTag = "";
            for (let attempt = 0; attempt < 1_000; attempt += 1) {
                const candidate = nametagGenerate();
                if (existingTags.has(candidate)) {
                    continue;
                }
                nextTag = candidate;
                break;
            }
            if (!nextTag) {
                throw new Error(`Failed to build unique usertag for user: ${user.id}`);
            }
            db.prepare("UPDATE users SET usertag = ? WHERE id = ?").run(nextTag, user.id);
            existingTags.add(nextTag);
        }

        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_usertag_required ON users(usertag)");

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS trg_users_usertag_required_insert
            BEFORE INSERT ON users
            FOR EACH ROW
            WHEN NEW.usertag IS NULL OR trim(NEW.usertag) = ''
            BEGIN
                SELECT RAISE(ABORT, 'users.usertag is required');
            END;
        `);

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS trg_users_usertag_required_update
            BEFORE UPDATE OF usertag ON users
            FOR EACH ROW
            WHEN NEW.usertag IS NULL OR trim(NEW.usertag) = ''
            BEGIN
                SELECT RAISE(ABORT, 'users.usertag is required');
            END;
        `);
    }
};
