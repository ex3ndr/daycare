import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionPermissions } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import type { ConfigModule } from "../config/configModule.js";
import { MemoryWorker, type MemoryWorkerPostFn } from "./memoryWorker.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

function mockConfig(): ConfigModule {
    return {
        current: { settings: { providers: [] } }
    } as unknown as ConfigModule;
}

async function createTestStorage() {
    const storage = await storageOpenTest();
    const owner = (await storage.users.findMany())[0];
    if (!owner) {
        throw new Error("Owner user missing");
    }
    await storage.agents.create({
        id: "agent-1",
        userId: owner.id,
        kind: "cron",
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
    return { storage, ownerId: owner.id };
}

function createWorker(storage: Storage, postFn?: MemoryWorkerPostFn, intervalMs = 100) {
    const worker = new MemoryWorker({
        storage,
        config: mockConfig(),
        intervalMs
    });
    worker.setPostFn(postFn ?? vi.fn().mockResolvedValue(undefined));
    return worker;
}

afterEach(() => {
    vi.useRealTimers();
});

async function expectEventually(assertion: () => void): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
            assertion();
            return;
        } catch {
            await vi.advanceTimersByTimeAsync(20);
        }
    }
    assertion();
}

async function expectEventuallyReal(assertion: () => void): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
            assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    }
    throw lastError;
}

describe("MemoryWorker", () => {
    it("routes invalidated sessions to memory-agent via postFn", async () => {
        vi.useFakeTimers();
        const { storage } = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            await storage.history.append(sessionId, { type: "user_message", at: 1001, text: "hello", files: [] });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const postFn = vi.fn().mockResolvedValue(undefined);
            const worker = createWorker(storage, postFn);
            worker.start();

            await vi.advanceTimersByTimeAsync(300);
            await expectEventually(() => {
                expect(postFn).toHaveBeenCalledOnce();
            });

            const [ctx, target, item] = postFn.mock.calls[0];
            expect(ctx.userId).toBeTypeOf("string");
            expect(ctx.agentId).toBe("agent-1");
            expect(target.path).toMatch(/\/memory$/);
            expect(item.type).toBe("system_message");
            expect(item.text).toContain("hello");
            // Background agent (cron) gets preamble and background labels
            expect(item.text).toContain("## System Message");
            expect(item.text).toContain("> Source:");
            expect(item.origin).toContain(sessionId);

            const memoryRoot = await storage.documents.findBySlugAndParent(
                contextForAgent({ userId: ctx.userId, agentId: "agent-1" }),
                "memory",
                null
            );
            expect(memoryRoot?.slug).toBe("memory");

            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).toBeNull();
            expect(session?.processedUntil).toBe(maxId);

            worker.stop();
        } finally {
            storage.connection.close();
        }
    });

    it("uses foreground labels and no preamble for user agents", async () => {
        vi.useFakeTimers();
        const { storage, ownerId } = await createTestStorage();
        try {
            await storage.agents.create({
                id: "user-agent-1",
                userId: ownerId,
                kind: "connector",
                type: "user",
                descriptor: { type: "user", connector: "web", userId: "u1", channelId: "ch1" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            const sessionId = await storage.sessions.create({ agentId: "user-agent-1", createdAt: 1000 });
            await storage.agents.update("user-agent-1", { activeSessionId: sessionId });
            await storage.history.append(sessionId, { type: "user_message", at: 1001, text: "hi", files: [] });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const postFn = vi.fn().mockResolvedValue(undefined);
            const worker = createWorker(storage, postFn);
            worker.start();

            await vi.advanceTimersByTimeAsync(300);
            await expectEventually(() => {
                expect(postFn).toHaveBeenCalledOnce();
            });

            const [, , item] = postFn.mock.calls[0];
            // Foreground agent (user) gets standard labels and no preamble
            expect(item.text).toContain("## User");
            expect(item.text).not.toContain("## System Message");
            expect(item.text).not.toContain("> Source:");

            worker.stop();
        } finally {
            storage.connection.close();
        }
    });

    it("skips sessions belonging to memory-agent descriptors", async () => {
        vi.useFakeTimers();
        const { storage, ownerId } = await createTestStorage();
        try {
            await storage.agents.create({
                id: "mem-agent-1",
                userId: ownerId,
                kind: "memory",
                type: "memory-agent",
                descriptor: { type: "memory-agent", id: "agent-1" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            const sessionId = await storage.sessions.create({ agentId: "mem-agent-1", createdAt: 1000 });
            await storage.history.append(sessionId, { type: "note", at: 1001, text: "obs" });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const postFn = vi.fn().mockResolvedValue(undefined);
            const worker = createWorker(storage, postFn);
            worker.start();

            await vi.advanceTimersByTimeAsync(150);

            // postFn should not be called for memory-agent sessions
            expect(postFn).not.toHaveBeenCalled();
            // Session should be marked as processed
            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).toBeNull();

            worker.stop();
        } finally {
            storage.connection.close();
        }
    });

    it("does not clear invalidated_at when it changed during processing", async () => {
        vi.useFakeTimers();
        const { storage } = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            const id1 = await storage.history.append(sessionId, {
                type: "user_message",
                at: 1001,
                text: "msg1",
                files: []
            });
            await storage.sessions.invalidate(sessionId, id1);

            // Monkey-patch findInvalidated to simulate new messages arriving during processing
            const originalFindInvalidated = storage.sessions.findInvalidated.bind(storage.sessions);
            let intercepted = false;
            storage.sessions.findInvalidated = async (limit: number) => {
                const result = await originalFindInvalidated(limit);
                if (!intercepted && result.length > 0) {
                    intercepted = true;
                    const id2 = await storage.history.append(sessionId, {
                        type: "user_message",
                        at: 1002,
                        text: "msg2",
                        files: []
                    });
                    await storage.sessions.invalidate(sessionId, id2);
                }
                return result;
            };

            const worker = createWorker(storage);
            worker.start();

            await vi.advanceTimersByTimeAsync(150);

            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).not.toBeNull();
            expect(session?.processedUntil).toBeNull();

            worker.stop();
        } finally {
            storage.connection.close();
        }
    });

    it("does not tick after stop", async () => {
        vi.useFakeTimers();
        const { storage } = await createTestStorage();
        try {
            const sessionId = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            await storage.agents.update("agent-1", { activeSessionId: sessionId });
            await storage.history.append(sessionId, { type: "user_message", at: 1001, text: "msg", files: [] });
            const maxId = await storage.history.maxId(sessionId);
            await storage.sessions.invalidate(sessionId, maxId!);

            const worker = createWorker(storage);
            worker.start();
            worker.stop();

            await vi.advanceTimersByTimeAsync(500);

            const session = await storage.sessions.findById(sessionId);
            expect(session?.invalidatedAt).toBe(maxId);
        } finally {
            storage.connection.close();
        }
    });

    it("processes multiple sessions in one tick", async () => {
        const { storage } = await createTestStorage();
        try {
            const s1 = await storage.sessions.create({ agentId: "agent-1", createdAt: 1000 });
            const s2 = await storage.sessions.create({ agentId: "agent-1", createdAt: 2000 });

            const id1 = await storage.history.append(s1, {
                type: "user_message",
                at: 1001,
                text: "a",
                files: []
            });
            const id2 = await storage.history.append(s2, {
                type: "user_message",
                at: 2001,
                text: "b",
                files: []
            });

            await storage.sessions.invalidate(s1, id1);
            await storage.sessions.invalidate(s2, id2);

            const postFn = vi.fn().mockResolvedValue(undefined);
            const worker = createWorker(storage, postFn, 20);
            worker.start();

            await expectEventuallyReal(() => {
                expect(postFn).toHaveBeenCalledTimes(2);
            });

            const session1 = await storage.sessions.findById(s1);
            const session2 = await storage.sessions.findById(s2);
            expect(session1?.invalidatedAt).toBeNull();
            expect(session2?.invalidatedAt).toBeNull();
            expect(session1?.processedUntil).toBe(id1);
            expect(session2?.processedUntil).toBe(id2);

            worker.stop();
        } finally {
            storage.connection.close();
        }
    });
});
