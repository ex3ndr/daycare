import { describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { tasksTriggerRemove } from "./tasksTriggerRemove.js";

describe("tasksTriggerRemove", () => {
    it("removes triggers", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerRemove({
            ctx,
            taskId: "task-1",
            body: {
                type: "cron"
            },
            cronTriggerRemove: async () => 2,
            webhookTriggerRemove: async () => 0
        });

        expect(result).toEqual({ ok: true, removed: 2 });
    });

    it("returns zero when no triggers were removed", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerRemove({
            ctx,
            taskId: "task-1",
            body: {
                type: "webhook"
            },
            cronTriggerRemove: async () => 0,
            webhookTriggerRemove: async () => 0
        });

        expect(result).toEqual({ ok: true, removed: 0 });
    });

    it("rejects invalid type", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const result = await tasksTriggerRemove({
            ctx,
            taskId: "task-1",
            body: {
                type: "heartbeat"
            },
            cronTriggerRemove: async () => 0,
            webhookTriggerRemove: async () => 0
        });

        expect(result).toEqual({ ok: false, error: "type must be cron or webhook." });
    });
});
