import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { HistoryRepository } from "./historyRepository.js";
import { Storage } from "./storage.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

async function createTestStorage() {
    const storage = Storage.open(":memory:");
    const owner = (await storage.users.findMany())[0];
    if (!owner) {
        throw new Error("Owner user missing");
    }
    await storage.agents.create({
        id: "agent-1",
        userId: owner.id,
        type: "cron",
        descriptor: { type: "cron", id: "agent-1", name: "job" },
        activeSessionId: null,
        permissions,
        tokens: null,
        stats: {},
        lifecycle: "active",
        createdAt: 1,
        updatedAt: 1
    });
    return storage;
}

describe("HistoryRepository", () => {
    it("appends and finds by session and agent", async () => {
        const storage = await createTestStorage();
        try {
            const sessionA = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
            const sessionB = await storage.sessions.create({ agentId: "agent-1", createdAt: 20 });
            const history = new HistoryRepository(storage.db);

            await history.append(sessionA, { type: "note", at: 11, text: "A1" });
            await history.append(sessionB, { type: "note", at: 21, text: "B1" });

            const bySession = await history.findBySessionId(sessionA);
            expect(bySession).toEqual([{ type: "note", at: 11, text: "A1" }]);

            const byAgent = await history.findByAgentId("agent-1");
            expect(byAgent).toEqual([
                { type: "note", at: 11, text: "A1" },
                { type: "note", at: 21, text: "B1" }
            ]);
        } finally {
            storage.close();
        }
    });

    it("append returns new record id", async () => {
        const storage = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
            const history = new HistoryRepository(storage.db);

            const id1 = await history.append(sessionId, { type: "note", at: 11, text: "first" });
            const id2 = await history.append(sessionId, { type: "note", at: 12, text: "second" });

            expect(id1).toBeGreaterThan(0);
            expect(id2).toBeGreaterThan(id1);
        } finally {
            storage.close();
        }
    });

    describe("findSinceId", () => {
        it("returns records after a given id", async () => {
            const storage = await createTestStorage();
            try {
                const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
                const history = new HistoryRepository(storage.db);

                const id1 = await history.append(sessionId, { type: "note", at: 11, text: "a" });
                await history.append(sessionId, { type: "note", at: 12, text: "b" });
                await history.append(sessionId, { type: "note", at: 13, text: "c" });

                const records = await history.findSinceId(sessionId, id1);
                expect(records).toHaveLength(2);
                expect(records[0]).toEqual({ type: "note", at: 12, text: "b" });
                expect(records[1]).toEqual({ type: "note", at: 13, text: "c" });
            } finally {
                storage.close();
            }
        });

        it("returns empty array when no records exist after id", async () => {
            const storage = await createTestStorage();
            try {
                const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
                const history = new HistoryRepository(storage.db);

                const lastId = await history.append(sessionId, { type: "note", at: 11, text: "a" });

                const records = await history.findSinceId(sessionId, lastId);
                expect(records).toHaveLength(0);
            } finally {
                storage.close();
            }
        });
    });

    describe("maxId", () => {
        it("returns max history record id", async () => {
            const storage = await createTestStorage();
            try {
                const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
                const history = new HistoryRepository(storage.db);

                await history.append(sessionId, { type: "note", at: 11, text: "a" });
                const id2 = await history.append(sessionId, { type: "note", at: 12, text: "b" });

                const maxId = await history.maxId(sessionId);
                expect(maxId).toBe(id2);
            } finally {
                storage.close();
            }
        });

        it("returns null for empty session", async () => {
            const storage = await createTestStorage();
            try {
                const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 10 });
                const history = new HistoryRepository(storage.db);

                const maxId = await history.maxId(sessionId);
                expect(maxId).toBeNull();
            } finally {
                storage.close();
            }
        });
    });
});
