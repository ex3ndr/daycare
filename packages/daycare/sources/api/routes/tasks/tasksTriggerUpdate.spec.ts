import { describe, expect, it, vi } from "vitest";
import { contextForAgent } from "../../../engine/agents/context.js";
import { tasksTriggerUpdate } from "./tasksTriggerUpdate.js";

describe("tasksTriggerUpdate", () => {
    it("updates enabled on a cron trigger", async () => {
        const cronTriggerUpdate = vi.fn(async () => ({
            id: "cron-1",
            taskId: "task-1",
            schedule: "0 */12 * * *",
            timezone: "UTC",
            agentId: "agent-1",
            enabled: false,
            deleteAfterRun: false,
            parameters: null,
            lastRunAt: null,
            createdAt: 1,
            updatedAt: 2
        }));

        const result = await tasksTriggerUpdate({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            taskId: "task-1",
            triggerId: "cron-1",
            body: { enabled: false },
            cronTriggerUpdate
        });

        expect(result).toEqual({
            ok: true,
            trigger: {
                id: "cron-1",
                type: "cron",
                taskId: "task-1",
                schedule: "0 */12 * * *",
                timezone: "UTC",
                agentId: "agent-1",
                enabled: false,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 2
            }
        });
        expect(cronTriggerUpdate).toHaveBeenCalledWith(
            contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            "task-1",
            "cron-1",
            {
                enabled: false
            }
        );
    });

    it("rejects invalid enabled values", async () => {
        const result = await tasksTriggerUpdate({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            taskId: "task-1",
            triggerId: "cron-1",
            body: { enabled: "nope" },
            cronTriggerUpdate: vi.fn()
        });

        expect(result).toEqual({ ok: false, error: "enabled must be a boolean." });
    });
});
