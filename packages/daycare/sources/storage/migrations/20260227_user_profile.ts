import type { Migration } from "./migrationTypes.js";

const MIGRATION_NAME = "20260227_user_profile";

export const migration20260227UserProfile: Migration = {
    name: MIGRATION_NAME,
    async up(db): Promise<void> {
        await Promise.all([
            db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text"),
            db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text"),
            db.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS country text"),
            db
                .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING")
                .run(MIGRATION_NAME, Date.now())
        ]);
    }
};
