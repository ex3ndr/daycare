import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { SessionsRepository } from "./sessionsRepository.js";
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

describe("SessionsRepository", () => {
    it("creates and finds sessions", async () => {
        const storage = await createTestStorage();
        try {
            const sessions = new SessionsRepository(storage.db);
            const sessionId = await sessions.create({
                agentId: "agent-1",
                inferenceSessionId: "infer-1",
                createdAt: 5,
                resetMessage: "manual"
            });

            const byId = await sessions.findById(sessionId);
            expect(byId).toEqual({
                id: sessionId,
                agentId: "agent-1",
                inferenceSessionId: "infer-1",
                createdAt: 5,
                resetMessage: "manual",
                invalidatedAt: null,
                processedUntil: null,
                endedAt: null
            });

            await sessions.create({ agentId: "agent-1", createdAt: 8 });
            const listed = await sessions.findByAgentId("agent-1");
            expect(listed).toHaveLength(2);
            expect(listed[0]?.createdAt).toBe(5);
            expect(listed[1]?.createdAt).toBe(8);
        } finally {
            storage.close();
        }
    });

    describe("endSession", () => {
        it("sets ended_at on an active session", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.endSession(sessionId, 2000);

                const session = await sessions.findById(sessionId);
                expect(session?.endedAt).toBe(2000);
            } finally {
                storage.close();
            }
        });

        it("does not overwrite ended_at if already set", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.endSession(sessionId, 2000);
                await sessions.endSession(sessionId, 3000);

                const session = await sessions.findById(sessionId);
                expect(session?.endedAt).toBe(2000);
            } finally {
                storage.close();
            }
        });
    });

    describe("invalidate", () => {
        it("sets invalidated_at when null", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.invalidate(sessionId, 42);

                const session = await sessions.findById(sessionId);
                expect(session?.invalidatedAt).toBe(42);
            } finally {
                storage.close();
            }
        });

        it("updates invalidated_at when new value is larger", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.invalidate(sessionId, 10);
                await sessions.invalidate(sessionId, 20);

                const session = await sessions.findById(sessionId);
                expect(session?.invalidatedAt).toBe(20);
            } finally {
                storage.close();
            }
        });

        it("keeps invalidated_at when new value is smaller", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.invalidate(sessionId, 20);
                await sessions.invalidate(sessionId, 10);

                const session = await sessions.findById(sessionId);
                expect(session?.invalidatedAt).toBe(20);
            } finally {
                storage.close();
            }
        });
    });

    describe("findInvalidated", () => {
        it("returns only invalidated sessions", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const s1 = await sessions.create({ agentId: "agent-1", createdAt: 1000 });
                const s2 = await sessions.create({ agentId: "agent-1", createdAt: 2000 });
                await sessions.create({ agentId: "agent-1", createdAt: 3000 });

                await sessions.invalidate(s1, 5);
                await sessions.invalidate(s2, 10);

                const result = await sessions.findInvalidated(10);
                expect(result.map((r) => r.id)).toEqual([s1, s2]);
            } finally {
                storage.close();
            }
        });

        it("respects limit", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const s1 = await sessions.create({ agentId: "agent-1", createdAt: 1000 });
                const s2 = await sessions.create({ agentId: "agent-1", createdAt: 2000 });

                await sessions.invalidate(s1, 5);
                await sessions.invalidate(s2, 10);

                const result = await sessions.findInvalidated(1);
                expect(result).toHaveLength(1);
                expect(result[0]?.id).toBe(s1);
            } finally {
                storage.close();
            }
        });

        it("orders by invalidated_at ascending", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const s1 = await sessions.create({ agentId: "agent-1", createdAt: 1000 });
                const s2 = await sessions.create({ agentId: "agent-1", createdAt: 2000 });

                await sessions.invalidate(s1, 20);
                await sessions.invalidate(s2, 5);

                const result = await sessions.findInvalidated(10);
                expect(result[0]?.id).toBe(s2);
                expect(result[1]?.id).toBe(s1);
            } finally {
                storage.close();
            }
        });
    });

    describe("markProcessed", () => {
        it("clears invalidated_at and sets processed_until on CAS match", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.invalidate(sessionId, 42);
                const ok = await sessions.markProcessed(sessionId, 42, 42);

                expect(ok).toBe(true);
                const session = await sessions.findById(sessionId);
                expect(session?.invalidatedAt).toBeNull();
                expect(session?.processedUntil).toBe(42);
            } finally {
                storage.close();
            }
        });

        it("fails when invalidated_at changed during processing", async () => {
            const storage = await createTestStorage();
            try {
                const sessions = new SessionsRepository(storage.db);
                const sessionId = await sessions.create({ agentId: "agent-1", createdAt: 1000 });

                await sessions.invalidate(sessionId, 42);
                // Simulate new messages arriving during processing
                await sessions.invalidate(sessionId, 100);
                const ok = await sessions.markProcessed(sessionId, 42, 42);

                expect(ok).toBe(false);
                const session = await sessions.findById(sessionId);
                expect(session?.invalidatedAt).toBe(100);
                expect(session?.processedUntil).toBeNull();
            } finally {
                storage.close();
            }
        });
    });
});
