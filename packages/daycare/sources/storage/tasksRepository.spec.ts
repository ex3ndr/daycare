import { describe, expect, it } from "vitest";
import { contextForAgent } from "../engine/agents/context.js";
import type { TaskDbRecord } from "./databaseTypes.js";
import { Storage } from "./storage.js";
import { TasksRepository } from "./tasksRepository.js";

describe("TasksRepository", () => {
    it("supports create, find, update, and delete", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new TasksRepository(storage.db);
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

            const byId = await repo.findById("task-1");
            expect(byId).toEqual(record);

            const byUser = await repo.findMany(contextForAgent({ userId: "user-1", agentId: "agent-1" }));
            expect(byUser).toHaveLength(1);
            expect(byUser[0]?.id).toBe("task-1");

            await repo.update("task-1", {
                title: "Daily report updated",
                code: "print('updated')",
                updatedAt: 20
            });

            const updated = await repo.findById("task-1");
            expect(updated?.title).toBe("Daily report updated");
            expect(updated?.code).toBe("print('updated')");
            expect(updated?.updatedAt).toBe(20);
            expect(updated?.deletedAt).toBeNull();

            expect(await repo.delete("task-1")).toBe(true);
            expect(await repo.delete("task-1")).toBe(false);
            expect(await repo.findById("task-1")).toBeNull();
            const deleted = await repo.findAnyById("task-1");
            expect(deleted?.id).toBe("task-1");
            expect(typeof deleted?.deletedAt).toBe("number");
        } finally {
            storage.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new TasksRepository(storage.db);
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

            const first = await repo.findById("cached-task");
            expect(first?.id).toBe("cached-task");

            storage.db.prepare("DELETE FROM tasks WHERE id = ?").run("cached-task");
            const second = await repo.findById("cached-task");
            expect(second?.id).toBe("cached-task");
        } finally {
            storage.close();
        }
    });
});
