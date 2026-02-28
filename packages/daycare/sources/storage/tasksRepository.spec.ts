import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import type { TaskDbRecord } from "./databaseTypes.js";
import { storageOpenTest } from "./storageOpenTest.js";
import { TasksRepository } from "./tasksRepository.js";

describe("TasksRepository", () => {
    it("supports create, find, update, and delete", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TasksRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            const record: TaskDbRecord = {
                id: "task-1",
                userId: "user-1",
                version: 1,
                validFrom: 10,
                validTo: null,
                title: "Daily report",
                description: "Summarize yesterday",
                code: "print('hello')",
                parameters: null,
                createdAt: 10,
                updatedAt: 10
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

            expect(await repo.delete(ctx, "task-1")).toBe(true);
            expect(await repo.delete(ctx, "task-1")).toBe(false);
            expect(await repo.findById(ctx, "task-1")).toBeNull();
            const deleted = await repo.findAnyById(ctx, "task-1");
            expect(deleted?.id).toBe("task-1");
            expect(typeof deleted?.validTo).toBe("number");
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TasksRepository(storage.db);
            const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            await repo.create({
                id: "cached-task",
                userId: "user-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                title: "Cache",
                description: null,
                code: "print('cache')",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById(ctx, "cached-task");
            expect(first?.id).toBe("cached-task");

            storage.connection.prepare("DELETE FROM tasks WHERE user_id = ? AND id = ?").run(ctx.userId, "cached-task");
            const second = await repo.findById(ctx, "cached-task");
            expect(second?.id).toBe("cached-task");
        } finally {
            storage.connection.close();
        }
    });

    it("scopes ids by user", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new TasksRepository(storage.db);
            const ctxA = contextForAgent({ userId: "user-1", agentId: "agent-1" });
            const ctxB = contextForAgent({ userId: "user-2", agentId: "agent-2" });

            await repo.create({
                id: "task-shared",
                userId: "user-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                title: "A",
                description: null,
                code: "print('a')",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "task-shared",
                userId: "user-2",
                version: 1,
                validFrom: 2,
                validTo: null,
                title: "B",
                description: null,
                code: "print('b')",
                parameters: null,
                createdAt: 2,
                updatedAt: 2
            });

            const first = await repo.findById(ctxA, "task-shared");
            const second = await repo.findById(ctxB, "task-shared");
            expect(first?.title).toBe("A");
            expect(second?.title).toBe("B");
        } finally {
            storage.connection.close();
        }
    });
});
