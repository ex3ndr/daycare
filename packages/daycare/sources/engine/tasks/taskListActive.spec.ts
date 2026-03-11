import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { taskListActive } from "./taskListActive.js";

describe("taskListActive", () => {
    it("returns only active tasks with grouped trigger execution metadata", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await storage.tasks.create({
                id: "task-active",
                userId: "user-1",
                title: "Active",
                description: "Has triggers",
                code: "print('active')",
                parameters: null,
                createdAt: 10,
                updatedAt: 10
            });
            await storage.tasks.create({
                id: "task-webhook",
                userId: "user-1",
                title: "Webhook",
                description: null,
                code: "print('webhook')",
                parameters: null,
                createdAt: 20,
                updatedAt: 20
            });
            await storage.tasks.create({
                id: "task-inactive",
                userId: "user-1",
                title: "Inactive",
                description: null,
                code: "print('inactive')",
                parameters: null,
                createdAt: 30,
                updatedAt: 30
            });

            await storage.cronTasks.create({
                id: "cron-active",
                taskId: "task-active",
                userId: "user-1",
                schedule: "0 * * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: 100,
                createdAt: 10,
                updatedAt: 10
            });
            await storage.cronTasks.create({
                id: "cron-disabled",
                taskId: "task-inactive",
                userId: "user-1",
                schedule: "15 * * * *",
                timezone: "UTC",
                agentId: null,
                enabled: false,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: 300,
                createdAt: 30,
                updatedAt: 30
            });
            await storage.webhookTasks.create({
                id: "webhook-active",
                taskId: "task-active",
                userId: "user-1",
                agentId: "agent-1",
                lastRunAt: 150,
                createdAt: 10,
                updatedAt: 10
            });
            await storage.webhookTasks.create({
                id: "webhook-only",
                taskId: "task-webhook",
                userId: "user-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 20,
                updatedAt: 20
            });

            const result = await taskListActive({ storage, ctx });

            expect(result.map((task) => task.id)).toEqual(["task-active", "task-webhook"]);
            expect(result[0]).toMatchObject({
                id: "task-active",
                lastExecutedAt: 150,
                triggers: {
                    cron: [{ id: "cron-active", lastExecutedAt: 100 }],
                    webhook: [{ id: "webhook-active", lastExecutedAt: 150 }]
                }
            });
            expect(result[1]).toMatchObject({
                id: "task-webhook",
                lastExecutedAt: null,
                triggers: {
                    cron: [],
                    webhook: [{ id: "webhook-only", lastExecutedAt: null }]
                }
            });
        } finally {
            storage.connection.close();
        }
    });

    it("includes active bundled core tasks when they have triggers", async () => {
        const storage = await storageOpenTest();
        try {
            const ctx = contextForUser({ userId: "user-1" });
            await storage.webhookTasks.create({
                id: "webhook-core",
                taskId: "core:ralph-loop",
                userId: "user-1",
                agentId: null,
                lastRunAt: 200,
                createdAt: 20,
                updatedAt: 20
            });

            const result = await taskListActive({ storage, ctx });
            const coreTask = result.find((task) => task.id === "core:ralph-loop");

            expect(coreTask).toMatchObject({
                id: "core:ralph-loop",
                lastExecutedAt: 200,
                triggers: {
                    webhook: [{ id: "webhook-core", lastExecutedAt: 200 }]
                }
            });
        } finally {
            storage.connection.close();
        }
    });
});
