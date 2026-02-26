import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260301AddTokenStats } from "./20260301_add_token_stats.js";

describe("migration20260301AddTokenStats", () => {
    it("creates token_stats_hourly table and indexes", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260301AddTokenStats.up(db);

            const columns = db.prepare("PRAGMA table_info(token_stats_hourly)").all() as Array<{ name: string }>;
            expect(columns.map((column) => column.name)).toEqual([
                "hour_start",
                "user_id",
                "agent_id",
                "model",
                "input_tokens",
                "output_tokens",
                "cache_read_tokens",
                "cache_write_tokens",
                "cost"
            ]);

            const indexes = db.prepare("PRAGMA index_list(token_stats_hourly)").all() as Array<{ name: string }>;
            const names = indexes.map((entry) => entry.name);
            expect(names).toContain("sqlite_autoindex_token_stats_hourly_1");
            expect(names).toContain("idx_token_stats_hourly_hour_start");
            expect(names).toContain("idx_token_stats_hourly_user_hour");
            expect(names).toContain("idx_token_stats_hourly_agent_hour");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            expect(() => migration20260301AddTokenStats.up(db)).not.toThrow();
            expect(() => migration20260301AddTokenStats.up(db)).not.toThrow();
        } finally {
            db.close();
        }
    });
});
