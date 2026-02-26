import { describe, expect, it } from "vitest";
import type { Context } from "@/types";

import { databaseOpenTest } from "./databaseOpenTest.js";
import { SignalEventsRepository } from "./signalEventsRepository.js";

describe("SignalEventsRepository", () => {
    it("creates records and filters by user/type", async () => {
        const db = databaseOpenTest();
        try {
            schemaCreate(db);
            const repository = new SignalEventsRepository(db);

            await repository.create({
                id: "ev-1",
                userId: "user-a",
                type: "build:ok",
                source: { type: "system", userId: "user-a" },
                data: { ok: true },
                createdAt: 10
            });
            await repository.create({
                id: "ev-2",
                userId: "user-b",
                type: "build:ok",
                source: { type: "system", userId: "user-b" },
                data: { ok: false },
                createdAt: 20
            });
            await repository.create({
                id: "ev-3",
                userId: "user-a",
                type: "build:fail",
                source: { type: "agent", id: "agent-1", userId: "user-a" },
                data: undefined,
                createdAt: 30
            });

            const all = await repository.findAll();
            const byUser = await repository.findMany(ctxBuild("user-a"));
            const byType = await repository.findAll({ type: "build:ok" });
            const byBoth = await repository.findMany(ctxBuild("user-a"), { type: "build:ok" });

            expect(all.map((entry) => entry.id)).toEqual(["ev-1", "ev-2", "ev-3"]);
            expect(byUser.map((entry) => entry.id)).toEqual(["ev-1", "ev-3"]);
            expect(byType.map((entry) => entry.id)).toEqual(["ev-1", "ev-2"]);
            expect(byBoth.map((entry) => entry.id)).toEqual(["ev-1"]);
            expect(byUser.every((entry) => entry.userId === "user-a")).toBe(true);
        } finally {
            db.close();
        }
    });

    it("returns recent records with limit normalization", async () => {
        const db = databaseOpenTest();
        try {
            schemaCreate(db);
            const repository = new SignalEventsRepository(db);

            for (let index = 1; index <= 5; index += 1) {
                await repository.create({
                    id: `ev-${index}`,
                    userId: "user-a",
                    type: "build:test",
                    source: { type: "system", userId: "user-a" },
                    data: { index },
                    createdAt: index
                });
            }

            const recentTwo = await repository.findRecent(ctxBuild("user-a"), 2);
            const recentHuge = await repository.findRecentAll(99_999);

            expect(recentTwo.map((entry) => entry.id)).toEqual(["ev-4", "ev-5"]);
            expect(recentHuge).toHaveLength(5);
        } finally {
            db.close();
        }
    });
});

function schemaCreate(db: ReturnType<typeof databaseOpenTest>): void {
    db.exec(`
        CREATE TABLE signals_events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            source TEXT NOT NULL,
            data TEXT,
            created_at INTEGER NOT NULL
        );
    `);
}

function ctxBuild(userId: string): Context {
    return { agentId: "test-agent", userId };
}
