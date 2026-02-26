import { describe, expect, it } from "vitest";

import { databaseOpen } from "./storage/databaseOpen.js";
import { migrationRun } from "./storage/migrations/migrationRun.js";

describe("schema", () => {
    it("keeps critical table and index invariants after migrations", () => {
        const db = databaseOpen(":memory:");
        try {
            migrationRun(db);

            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC")
                .all() as Array<{ name?: string }>;
            const tableNames = new Set(tables.map((entry) => entry.name).filter((entry): entry is string => !!entry));

            expect(tableNames.has("users")).toBe(true);
            expect(tableNames.has("tasks")).toBe(true);
            expect(tableNames.has("token_stats_hourly")).toBe(true);

            const indexes = db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name ASC")
                .all() as Array<{ name?: string }>;
            const indexNames = new Set(indexes.map((entry) => entry.name).filter((entry): entry is string => !!entry));

            expect(indexNames.has("idx_users_nametag_required")).toBe(true);
            expect(indexNames.has("idx_users_single_owner")).toBe(true);
            expect(indexNames.has("idx_tasks_cron_task_id")).toBe(true);
            expect(indexNames.has("idx_token_stats_hourly_agent_hour")).toBe(true);
        } finally {
            db.close();
        }
    });
});
