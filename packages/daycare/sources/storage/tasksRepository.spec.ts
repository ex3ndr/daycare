import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import type { TaskDbRecord } from "./databaseTypes.js";
import { storageOpen } from "./storageOpen.js";
import { TasksRepository } from "./tasksRepository.js";

describe("TasksRepository", () => {
    it("supports create, find, update, and delete", async () => {
        const storage = storageOpen(":memory:");
        try {
            const repo = new TasksRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            const record: TaskDbRecord = {
                id: "task-1",
                userId: "user-1",
                title: "Daily report",
                description: "Summarize yesterday",
                code: "print('hello')",
                createdAt: 10,
                updatedAt: 10,
                deletedAt: null
            };

            await repo.create(record);

            const byId = await repo.findById(ctx, "task-1");
            expect(byId).toEqual(record);

            const byUser = await repo.findMany(ctx);
            expect(byUser).toHaveLength(1);
            expect(byUser[0]?.id).toBe("task-1");

            await repo.update(ctx, "task-1", {
                title: "Daily report updated",
                code: "print('updated')",
                updatedAt: 20
            });

            const updated = await repo.findById(ctx, "task-1");
            expect(updated?.title).toBe("Daily report updated");
            expect(updated?.code).toBe("print('updated')");
            expect(updated?.updatedAt).toBe(20);
            expect(updated?.deletedAt).toBeNull();

            expect(await repo.delete(ctx, "task-1")).toBe(true);
            expect(await repo.delete(ctx, "task-1")).toBe(false);
            expect(await repo.findById(ctx, "task-1")).toBeNull();
            const deleted = await repo.findAnyById(ctx, "task-1");
            expect(deleted?.id).toBe("task-1");
            expect(typeof deleted?.deletedAt).toBe("number");
        } finally {
            storage.db.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = storageOpen(":memory:");
        try {
            const repo = new TasksRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create({
                id: "cached-task",
                userId: "user-1",
                title: "Cache",
                description: null,
                code: "print('cache')",
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null
            });

            const first = await repo.findById(ctx, "cached-task");
            expect(first?.id).toBe("cached-task");

            storage.db.prepare("DELETE FROM tasks WHERE user_id = ? AND id = ?").run(ctx.userId, "cached-task");
            const second = await repo.findById(ctx, "cached-task");
            expect(second?.id).toBe("cached-task");
        } finally {
            storage.db.close();
        }
    });

    it("scopes ids by user", async () => {
        const storage = storageOpen(":memory:");
        try {
            const repo = new TasksRepository(storage.db);
            const ctxA = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            const ctxB = contextForAgent({ userId: "user-2", agentId: "agent-2" });

            await repo.create({
                id: "task-shared",
                userId: "user-1",
                title: "A",
                description: null,
                code: "print('a')",
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null
            });
            await repo.create({
                id: "task-shared",
                userId: "user-2",
                title: "B",
                description: null,
                code: "print('b')",
                createdAt: 2,
                updatedAt: 2,
                deletedAt: null
            });

            const first = await repo.findById(ctxA, "task-shared");
            const second = await repo.findById(ctxB, "task-shared");
            expect(first?.title).toBe("A");
            expect(second?.title).toBe("B");
        } finally {
            storage.db.close();
        }
    });
});
