import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { taskListAll } from "./taskListAll.js";

describe("taskListAll", () => {
    it("returns all tasks with triggers separated, including tasks without triggers", async () => {
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
                title: "Webhook Only",
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
                id: "cron-enabled",
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

            const result = await taskListAll({ storage, ctx });

            // All three tasks returned (including task-inactive without enabled triggers)
            expect(result.tasks.map((t) => t.id)).toEqual(["task-active", "task-webhook", "task-inactive"]);

            // task-active: lastExecutedAt from max of cron(100) and webhook(150) = 150
            expect(result.tasks[0]).toMatchObject({
                id: "task-active",
                title: "Active",
                lastExecutedAt: 150
            });

            // task-webhook: no executions
            expect(result.tasks[1]).toMatchObject({
                id: "task-webhook",
                lastExecutedAt: null
            });

            // task-inactive: lastExecutedAt from disabled cron = 300
            expect(result.tasks[2]).toMatchObject({
                id: "task-inactive",
                lastExecutedAt: 300
            });

            // Triggers are separate and include disabled cron
            expect(result.triggers.cron).toHaveLength(2);
            expect(result.triggers.cron[0]).toMatchObject({
                id: "cron-disabled",
                taskId: "task-inactive",
                enabled: false
            });
            expect(result.triggers.cron[1]).toMatchObject({
                id: "cron-enabled",
                taskId: "task-active",
                enabled: true
            });

            expect(result.triggers.webhook).toHaveLength(2);
            expect(result.triggers.webhook[0]).toMatchObject({
                id: "webhook-active",
                taskId: "task-active"
            });
            expect(result.triggers.webhook[1]).toMatchObject({
                id: "webhook-only",
                taskId: "task-webhook"
            });
        } finally {
            storage.connection.close();
        }
    });
});
