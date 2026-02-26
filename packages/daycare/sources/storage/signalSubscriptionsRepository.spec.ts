import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { databaseOpenTest } from "./databaseOpenTest.js";
import { SignalSubscriptionsRepository } from "./signalSubscriptionsRepository.js";

describe("SignalSubscriptionsRepository", () => {
    it("creates, updates, deletes, and reads subscriptions", async () => {
        const db = databaseOpenTest(":memory:");
        try {
            schemaCreate(db);
            const repository = new SignalSubscriptionsRepository(db);

            await repository.create({
                id: "sub-1",
                userId: "user-a",
                agentId: "agent-1",
                pattern: "build:*",
                silent: true,
                createdAt: 10,
                updatedAt: 10
            });

            await repository.create({
                id: "sub-2",
                userId: "user-a",
                agentId: "agent-1",
                pattern: "build:*",
                silent: false,
                createdAt: 10,
                updatedAt: 20
            });

            const found = await repository.findByUserAndAgent(ctxBuild("user-a", "agent-1"), "build:*");
            expect(found?.id).toBe("sub-2");
            expect(found?.silent).toBe(false);

            const removed = await repository.delete(ctxBuild("user-a", "agent-1"), "build:*");
            const missing = await repository.findByUserAndAgent(ctxBuild("user-a", "agent-1"), "build:*");

            expect(removed).toBe(true);
            expect(missing).toBeNull();
        } finally {
            db.close();
        }
    });

    it("matches patterns and user scope", async () => {
        const db = databaseOpenTest(":memory:");
        try {
            schemaCreate(db);
            const repository = new SignalSubscriptionsRepository(db);

            await repository.create({
                id: "sub-a",
                userId: "user-a",
                agentId: "agent-a",
                pattern: "build:*:done",
                silent: false,
                createdAt: 1,
                updatedAt: 1
            });
            await repository.create({
                id: "sub-b",
                userId: "user-b",
                agentId: "agent-b",
                pattern: "build:*:done",
                silent: true,
                createdAt: 2,
                updatedAt: 2
            });
            await repository.create({
                id: "sub-c",
                userId: "user-a",
                agentId: "agent-c",
                pattern: "deploy:*",
                silent: true,
                createdAt: 3,
                updatedAt: 3
            });

            const allMatches = [
                ...(await repository.findMatching(ctxBuild("user-a"), "build:app:done")),
                ...(await repository.findMatching(ctxBuild("user-b"), "build:app:done"))
            ];
            const userMatches = await repository.findMatching(ctxBuild("user-a"), "build:app:done");

            expect(allMatches.map((entry) => entry.id).sort()).toEqual(["sub-a", "sub-b"]);
            expect(userMatches.map((entry) => entry.id)).toEqual(["sub-a"]);
        } finally {
            db.close();
        }
    });

    it("normalizes ctx userId for keyed and matching lookups", async () => {
        const db = databaseOpenTest(":memory:");
        try {
            schemaCreate(db);
            const repository = new SignalSubscriptionsRepository(db);

            await repository.create({
                id: "sub-trim",
                userId: "user-trim",
                agentId: "agent-1",
                pattern: "build:*",
                silent: false,
                createdAt: 1,
                updatedAt: 1
            });

            const byKey = await repository.findByUserAndAgent(ctxBuild("  user-trim  ", "agent-1"), "build:*");
            const matching = await repository.findMatching(ctxBuild("  user-trim  "), "build:foo");

            expect(byKey?.id).toBe("sub-trim");
            expect(matching.map((entry) => entry.id)).toEqual(["sub-trim"]);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        CREATE TABLE signals_subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            pattern TEXT NOT NULL,
            silent INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(user_id, agent_id, pattern)
        );
    `);
}

function ctxBuild(userId: string, agentId = "test-agent"): Context {
    return { agentId, userId };
}
