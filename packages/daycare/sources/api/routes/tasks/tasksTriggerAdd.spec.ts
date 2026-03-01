import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksTriggerAdd } from "./tasksTriggerAdd.js";

describe("tasksTriggerAdd", () => {
    it("adds a cron trigger", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerAdd({
            ctx,
            taskId: "task-1",
            body: {
                type: "cron",
                schedule: "0 * * * *",
                timezone: "UTC"
            },
            cronTriggerAdd: async () => ({
                id: "cron-1",
                taskId: "task-1",
                schedule: "0 * * * *",
                timezone: "UTC",
                agentId: null,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            }),
            webhookTriggerAdd: async () => {
                throw new Error("not used");
            }
        });

        expect(result).toEqual({
            ok: true,
            trigger: {
                id: "cron-1",
                type: "cron",
                taskId: "task-1",
                schedule: "0 * * * *",
                timezone: "UTC",
                agentId: null,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            }
        });
    });

    it("adds a webhook trigger", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerAdd({
            ctx,
            taskId: "task-1",
            body: {
                type: "webhook"
            },
            cronTriggerAdd: async () => {
                throw new Error("not used");
            },
            webhookTriggerAdd: async () => ({
                id: "wh-1",
                taskId: "task-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            })
        });

        expect(result).toEqual({
            ok: true,
            trigger: {
                id: "wh-1",
                type: "webhook",
                taskId: "task-1",
                agentId: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            }
        });
    });

    it("rejects invalid trigger type", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerAdd({
            ctx,
            taskId: "task-1",
            body: {
                type: "heartbeat"
            },
            cronTriggerAdd: async () => {
                throw new Error("not used");
            },
            webhookTriggerAdd: async () => {
                throw new Error("not used");
            }
        });

        expect(result).toEqual({ ok: false, error: "type must be cron or webhook." });
    });

    it("requires schedule for cron triggers", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerAdd({
            ctx,
            taskId: "task-1",
            body: {
                type: "cron"
            },
            cronTriggerAdd: async () => {
                throw new Error("not used");
            },
            webhookTriggerAdd: async () => {
                throw new Error("not used");
            }
        });

        expect(result).toEqual({ ok: false, error: "schedule is required for cron triggers." });
    });

    it("returns validation error for invalid timezone", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerAdd({
            ctx,
            taskId: "task-1",
            body: {
                type: "cron",
                schedule: "0 * * * *",
                timezone: "Not/AZone"
            },
            cronTriggerAdd: async () => {
                throw new Error("not used");
            },
            webhookTriggerAdd: async () => {
                throw new Error("not used");
            }
        });

        expect(result).toEqual({ ok: false, error: "Invalid cron timezone: Not/AZone" });
    });
});
