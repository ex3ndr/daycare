import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migrations } from "./_migrations.js";
import { migrationRun } from "./migrationRun.js";

describe("migrationRun", () => {
    it("applies migrations once and is idempotent", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-migration-run-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpen(dbPath);
            const firstApplied = migrationRun(db);
            const secondApplied = migrationRun(db);

            const tableRows = db.prepare("SELECT name FROM _migrations ORDER BY name").all() as Array<{ name: string }>;
            const agentTable = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
                .get() as { name?: string } | undefined;
            const sessionTable = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
                .get() as { name?: string } | undefined;
            const historyTable = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_history'")
                .get() as { name?: string } | undefined;
            db.close();

            expect(firstApplied).toEqual(migrations.map((entry) => entry.name));
            expect(secondApplied).toEqual([]);
            expect(tableRows.map((row) => row.name)).toEqual(migrations.map((entry) => entry.name).sort());
            expect(agentTable?.name).toBe("agents");
            expect(sessionTable?.name).toBe("sessions");
            expect(historyTable?.name).toBe("session_history");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reruns non-transactional snapshot cleanup migration with batched commits", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-migration-run-"));
        const dbPath = path.join(dir, "daycare.db");
        try {
            const db = databaseOpen(dbPath);
            migrationRun(db);
            db.exec("PRAGMA foreign_keys = OFF");
            db.prepare(
                "INSERT INTO session_history (session_id, type, at, data) VALUES (?, ?, ?, ?)"
            ).run("session-1", "rlm_tool_call", 1, JSON.stringify({ snapshot: "AQID", toolName: "echo" }));
            db.exec("PRAGMA foreign_keys = ON");
            db.prepare("DELETE FROM _migrations WHERE name = ?").run("20260302_cleanup_rlm_snapshot_payloads");

            const reapplied = migrationRun(db);
            const row = db.prepare("SELECT data FROM session_history WHERE type = 'rlm_tool_call' LIMIT 1").get() as
                | { data: string }
                | undefined;
            db.close();

            expect(reapplied).toContain("20260302_cleanup_rlm_snapshot_payloads");
            expect(row?.data).not.toContain('"snapshot"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
