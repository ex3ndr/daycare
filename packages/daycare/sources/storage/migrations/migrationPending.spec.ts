import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migrations } from "./_migrations.js";
import { migrationPending } from "./migrationPending.js";

describe("migrationPending", () => {
    it("returns all migrations when _migrations is missing", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-migration-pending-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpenTest();
            const pending = migrationPending(db, migrations);
            db.close();

            expect(pending.map((entry) => entry.name)).toEqual(migrations.map((entry) => entry.name));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("filters already-applied migrations", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-migration-pending-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpenTest();
            db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
            const firstMigration = migrations[0];
            if (!firstMigration) {
                throw new Error("Missing base migration");
            }
            db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(firstMigration.name, Date.now());

            const pending = migrationPending(db, migrations);
            db.close();

            expect(pending.map((entry) => entry.name)).toEqual(migrations.slice(1).map((entry) => entry.name));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
