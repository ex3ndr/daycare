import type { DatabaseSync } from "node:sqlite";
import { migrations } from "./_migrations.js";
import { migrationPending } from "./migrationPending.js";

/**
 * Applies pending migrations in order and records each successful migration.
 * Expects: migration definitions are deterministic and side-effect free outside SQL.
 */
export function migrationRun(db: DatabaseSync): string[] {
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

    const pending = migrationPending(db, migrations);
    const applied: string[] = [];

    for (const migration of pending) {
        db.exec("BEGIN");
        try {
            migration.up(db);
            db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(migration.name, Date.now());
            db.exec("COMMIT");
            applied.push(migration.name);
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }

    return applied;
}
