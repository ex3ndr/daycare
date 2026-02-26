import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "./storage/databaseOpenTest.js";
import { migrationRun } from "./storage/migrations/migrationRun.js";

describe("schema", () => {
    it("keeps critical table and index invariants after migrations", async () => {
        const db = databaseOpenTest();
        try {
            migrationRun(db);

            const tables = await db
                .prepare(
                    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC"
                )
                .all() as Array<{ name?: string }>;
            const tableNames = new Set(tables.map((entry) => entry.name).filter((entry): entry is string => !!entry));

            expect(tableNames.has("users")).toBe(true);
            expect(tableNames.has("tasks")).toBe(true);
            expect(tableNames.has("token_stats_hourly")).toBe(true);

            const indexes = await db
                .prepare("SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname ASC")
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
