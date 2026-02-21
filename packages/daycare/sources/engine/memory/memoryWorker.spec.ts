import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import { Storage } from "../../storage/storage.js";
import { MemoryWorker } from "./memoryWorker.js";

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

afterEach(() => {
    vi.useRealTimers();
});

describe("MemoryWorker", () => {
    it("processes invalidated sessions on tick", async () => {
        vi.useFakeTimers();
        const storage = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            await storage.history.append(sessionId, { type: "note", at: 1001, text: "msg" });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const worker = new MemoryWorker({ storage, intervalMs: 100 });
            worker.start();

            // Advance timer to trigger tick
            await vi.advanceTimersByTimeAsync(150);

            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).toBeNull();
            expect(session?.processedUntil).toBe(maxId);

            worker.stop();
        } finally {
            storage.close();
        }
    });

    it("does not clear invalidated_at when it changed during processing", async () => {
        vi.useFakeTimers();
        const storage = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            const id1 = await storage.history.append(sessionId, { type: "note", at: 1001, text: "msg1" });
            await storage.sessions.invalidate(sessionId, id1);

            // Monkey-patch findInvalidated to simulate new messages arriving during processing
            const originalFindInvalidated = storage.sessions.findInvalidated.bind(storage.sessions);
            let intercepted = false;
            storage.sessions.findInvalidated = async (limit: number) => {
                const result = await originalFindInvalidated(limit);
                if (!intercepted && result.length > 0) {
                    intercepted = true;
                    // Simulate a new history record arriving and re-invalidating
                    const id2 = await storage.history.append(sessionId, { type: "note", at: 1002, text: "msg2" });
                    await storage.sessions.invalidate(sessionId, id2);
                }
                return result;
            };

            const worker = new MemoryWorker({ storage, intervalMs: 100 });
            worker.start();

            await vi.advanceTimersByTimeAsync(150);

            // Session should still be invalidated because invalidated_at changed
            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).not.toBeNull();
            expect(session?.processedUntil).toBeNull();

            worker.stop();
        } finally {
            storage.close();
        }
    });

    it("does not tick after stop", async () => {
        vi.useFakeTimers();
        const storage = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            await storage.history.append(sessionId, { type: "note", at: 1001, text: "msg" });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const worker = new MemoryWorker({ storage, intervalMs: 100 });
            worker.start();
            worker.stop();

            // Advance past multiple tick intervals
            await vi.advanceTimersByTimeAsync(500);

            // Session should still be invalidated since worker was stopped
            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).toBe(maxId);
        } finally {
            storage.close();
        }
    });

    it("processes multiple sessions in one tick", async () => {
        vi.useFakeTimers();
        const storage = await createTestStorage();
        try {
            const s1 = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            const s2 = await storage.sessions.create({ agentId: "agent-1", createdAt: 2000 });

            const id1 = await storage.history.append(s1, { type: "note", at: 1001, text: "a" });
            const id2 = await storage.history.append(s2, { type: "note", at: 2001, text: "b" });

            await storage.sessions.invalidate(s1, id1);
            await storage.sessions.invalidate(s2, id2);

            const worker = new MemoryWorker({ storage, intervalMs: 100 });
            worker.start();

            await vi.advanceTimersByTimeAsync(150);

            const session1 = await storage.sessions.findById(s1);
            const session2 = await storage.sessions.findById(s2);
            expect(session1?.invalidatedAt).toBeNull();
            expect(session2?.invalidatedAt).toBeNull();
            expect(session1?.processedUntil).toBe(id1);
            expect(session2?.processedUntil).toBe(id2);

            worker.stop();
        } finally {
            storage.close();
        }
    });
});
