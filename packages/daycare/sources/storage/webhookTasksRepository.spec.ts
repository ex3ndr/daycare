import { describe, expect, it } from "vitest";
import { contextForUser } from "../engine/agents/context.js";
import type { WebhookTaskDbRecord } from "./databaseTypes.js";
import { storageOpenTest } from "./storageOpenTest.js";
import { WebhookTasksRepository } from "./webhookTasksRepository.js";

describe("WebhookTasksRepository", () => {
    it("supports create, find, and delete", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new WebhookTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-alpha",
                userId: "user-1",
                title: "Alpha",
                description: null,
                code: "Check alpha",
                parameters: null,
                createdAt: 10,
                updatedAt: 10
            });
            await storage.tasks.create({
                id: "task-beta",
                userId: "user-1",
                title: "Beta",
                description: null,
                code: "Check beta",
                parameters: null,
                createdAt: 11,
                updatedAt: 11
            });
            const first: WebhookTaskDbRecord = {
                id: "hook-alpha",
                version: 1,
                validFrom: 10,
                validTo: null,
                taskId: "task-alpha",
                userId: "user-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 10,
                updatedAt: 10
            };
            const second: WebhookTaskDbRecord = {
                id: "hook-beta",
                version: 1,
                validFrom: 11,
                validTo: null,
                taskId: "task-beta",
                userId: "user-1",
                agentId: "agent-1",
                lastRunAt: null,
                createdAt: 11,
                updatedAt: 11
            };

            await repo.create(first);
            await repo.create(second);

            expect(await repo.findById("hook-alpha")).toEqual(first);

            const byUser = await repo.findMany(contextForUser({ userId: "user-1" }));
            expect(byUser).toHaveLength(2);

            const byTask = await repo.findManyByTaskId(contextForUser({ userId: "user-1" }), "task-beta");
            expect(byTask).toEqual([second]);

            const all = await repo.findAll();
            expect(all.map((record) => record.id).sort()).toEqual(["hook-alpha", "hook-beta"]);

            expect(await repo.delete("hook-beta")).toBe(true);
            expect(await repo.delete("hook-beta")).toBe(false);
            expect(await repo.findById("hook-beta")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached trigger on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new WebhookTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-cache",
                userId: "user-1",
                title: "Cache",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "hook-cache",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-cache",
                userId: "user-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("hook-cache");
            expect(first?.id).toBe("hook-cache");

            storage.connection.prepare("DELETE FROM tasks_webhook WHERE id = ?").run("hook-cache");
            const second = await repo.findById("hook-cache");
            expect(second?.id).toBe("hook-cache");
        } finally {
            storage.connection.close();
        }
    });

    it("rejects invalid task references", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new WebhookTasksRepository(storage.db);
            await expect(
                repo.create({
                    id: "hook-bad",
                    taskId: "",
                    userId: "user-1",
                    agentId: null,
                    lastRunAt: null,
                    createdAt: 1,
                    updatedAt: 1
                })
            ).rejects.toThrow("Webhook trigger taskId is required.");

            await storage.connection
                .prepare(
                    "INSERT INTO tasks (id, user_id, version, valid_from, valid_to, title, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .run("   ", "user-1", 1, 1, null, "Bad", null, "print('bad')", 1, 1);
            await storage.connection
                .prepare(
                    "INSERT INTO tasks_webhook (id, version, valid_from, valid_to, task_id, user_id, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .run("hook-row-bad", 1, 1, null, "   ", "user-1", null, 1, 1);
            await expect(repo.findById("hook-row-bad")).rejects.toThrow(
                "Webhook trigger hook-row-bad is missing required task_id."
            );
        } finally {
            storage.connection.close();
        }
    });

    it("records last webhook run time", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new WebhookTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-run",
                userId: "user-1",
                title: "Run",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "hook-run",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-run",
                userId: "user-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            await repo.recordRun("hook-run", 50);

            const updated = await repo.findById("hook-run");
            expect(updated?.lastRunAt).toBe(50);
            expect(updated?.updatedAt).toBe(50);
        } finally {
            storage.connection.close();
        }
    });
});
