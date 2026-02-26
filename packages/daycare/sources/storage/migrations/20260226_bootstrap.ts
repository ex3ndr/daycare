import { readFileSync } from "node:fs";

import type { StorageDatabase } from "../databaseOpen.js";
import type { Migration } from "./migrationTypes.js";

const BOOTSTRAP_SQL = bootstrapSqlBuild();
const OWNER_USER_ID = "sy45wijd1hmr03ef2wu7busv";
const OWNER_USER_NAMETAG = "owner";

export const migration20260226Bootstrap: Migration = {
    name: "20260226_bootstrap",
    up(db): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS _migrations (
                name text PRIMARY KEY NOT NULL,
                applied_at bigint NOT NULL
            );
        `);

        for (const statement of BOOTSTRAP_SQL) {
            db.exec(statement);
        }

        db.prepare(
            `
            INSERT INTO users (id, is_owner, created_at, updated_at, parent_user_id, name, nametag)
            SELECT ?, 1, 0, 0, NULL, 'Owner', ?
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_owner = 1)
            `
        ).run(OWNER_USER_ID, OWNER_USER_NAMETAG);

        db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(
            this.name,
            Date.now()
        );
    }
};

function bootstrapSqlBuild(): string[] {
    const sqlPath = new URL("./0000_bootstrap.sql", import.meta.url);
    const raw = readFileSync(sqlPath, "utf8");
    return raw
        .split("--> statement-breakpoint")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .filter((entry) => !entry.startsWith('CREATE TABLE "_migrations"'))
        .map((entry) => statementIdempotentBuild(entry));
}

function statementIdempotentBuild(statement: string): string {
    const normalized = statement.endsWith(";") ? statement.slice(0, -1).trimEnd() : statement;

    if (normalized.startsWith("CREATE TABLE \"")) {
        return normalized.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "');
    }

    if (normalized.startsWith("CREATE UNIQUE INDEX ")) {
        return normalized.replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ");
    }

    if (normalized.startsWith("CREATE INDEX ")) {
        return normalized.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");
    }

    if (normalized.startsWith("ALTER TABLE ") && normalized.includes(" ADD CONSTRAINT ")) {
        return `DO $$ BEGIN ${normalized}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
    }

    return normalized;
}
