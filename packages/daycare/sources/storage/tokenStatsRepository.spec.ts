import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { databaseOpen } from "./databaseOpen.js";
import { TokenStatsRepository } from "./tokenStatsRepository.js";

describe("TokenStatsRepository", () => {
    it("increments hourly rows and merges by hour/user/agent/model", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new TokenStatsRepository(db);
            const ctx = ctxBuild("user-a", "agent-a");
            const hour = Date.UTC(2026, 1, 26, 9, 12, 0, 0);

            await repository.increment(ctx, {
                at: hour,
                model: "openai/gpt-5-mini",
                input: 10,
                output: 4,
                cacheRead: 2,
                cacheWrite: 1,
                cost: 0.25
            });
            await repository.increment(ctx, {
                at: hour + 30_000,
                model: "openai/gpt-5-mini",
                input: 1,
                output: 3,
                cacheRead: 4,
                cacheWrite: 5,
                cost: 0.05
            });

            const rows = await repository.findAll();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual({
                hourStart: Date.UTC(2026, 1, 26, 9, 0, 0, 0),
                userId: "user-a",
                agentId: "agent-a",
                model: "openai/gpt-5-mini",
                input: 11,
                output: 7,
                cacheRead: 6,
                cacheWrite: 6,
                cost: 0.3
            });
        } finally {
            db.close();
        }
    });

    it("filters rows by range and identity", async () => {
        const db = databaseOpen(":memory:");
        try {
            schemaCreate(db);
            const repository = new TokenStatsRepository(db);

            await repository.increment(ctxBuild("user-a", "agent-a"), {
                at: Date.UTC(2026, 1, 26, 8, 5, 0, 0),
                model: "anthropic/claude-sonnet-4-5",
                input: 10,
                output: 1,
                cacheRead: 0,
                cacheWrite: 0,
                cost: 0.2
            });
            await repository.increment(ctxBuild("user-a", "agent-b"), {
                at: Date.UTC(2026, 1, 26, 9, 5, 0, 0),
                model: "openai/gpt-5",
                input: 2,
                output: 3,
                cacheRead: 1,
                cacheWrite: 1,
                cost: 0.1
            });
            await repository.increment(ctxBuild("user-b", "agent-c"), {
                at: Date.UTC(2026, 1, 26, 10, 5, 0, 0),
                model: "openai/gpt-5",
                input: 9,
                output: 9,
                cacheRead: 9,
                cacheWrite: 9,
                cost: 0.9
            });

            const range = await repository.findAll({
                from: Date.UTC(2026, 1, 26, 9, 0, 0, 0),
                to: Date.UTC(2026, 1, 26, 10, 59, 0, 0)
            });
            expect(range).toHaveLength(2);

            const byUser = await repository.findAll({ userId: "user-a" });
            expect(byUser).toHaveLength(2);
            expect(byUser.every((row) => row.userId === "user-a")).toBe(true);

            const byAgent = await repository.findAll({ agentId: "agent-b" });
            expect(byAgent).toHaveLength(1);
            expect(byAgent[0]?.agentId).toBe("agent-b");

            const byModel = await repository.findAll({ model: "openai/gpt-5" });
            expect(byModel).toHaveLength(2);
            expect(byModel.every((row) => row.model === "openai/gpt-5")).toBe(true);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpen>): void {
    db.exec(`
        CREATE TABLE token_stats_hourly (
            hour_start INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cache_read_tokens INTEGER NOT NULL DEFAULT 0,
            cache_write_tokens INTEGER NOT NULL DEFAULT 0,
            cost REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (hour_start, user_id, agent_id, model)
        );
    `);
}

function ctxBuild(userId: string, agentId: string): Context {
    return { userId, agentId };
}
