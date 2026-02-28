import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { agentsTable, usersTable } from "../schema.js";
import { storageOpenTest } from "./storageOpenTest.js";
import { TokenStatsRepository } from "./tokenStatsRepository.js";

async function createTestEntities(
    storage: Awaited<ReturnType<typeof storageOpenTest>>,
    users: string[],
    agents: string[]
) {
    for (const userId of users) {
        await storage.db.insert(usersTable).values({
            id: userId,
            version: 1,
            validFrom: 1,
            validTo: null,
            nametag: `tag-${userId}`,
            isOwner: 0,
            createdAt: 1,
            updatedAt: 1
        });
    }
    for (const agentId of agents) {
        await storage.db.insert(agentsTable).values({
            id: agentId,
            version: 1,
            validFrom: 1,
            validTo: null,
            userId: users[0] ?? "user-a",
            type: "cron",
            descriptor: JSON.stringify({ type: "cron", id: agentId, name: agentId }),
            permissions: JSON.stringify({ workingDir: "/tmp", writeDirs: ["/tmp"] }),
            stats: "{}",
            lifecycle: "active",
            createdAt: 1,
            updatedAt: 1
        });
    }
}

describe("TokenStatsRepository", () => {
    it("increments hourly rows and merges by hour/user/agent/model", async () => {
        const storage = await storageOpenTest();
        try {
            await createTestEntities(storage, ["user-a"], ["agent-a"]);
            const repository = new TokenStatsRepository(storage.db);
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
            storage.connection.close();
        }
    });

    it("filters rows by range and identity", async () => {
        const storage = await storageOpenTest();
        try {
            await createTestEntities(storage, ["user-a", "user-b"], ["agent-a", "agent-b", "agent-c"]);
            const repository = new TokenStatsRepository(storage.db);

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
            storage.connection.close();
        }
    });
});

function ctxBuild(userId: string, agentId: string): Context {
    return { userId, agentId };
}
