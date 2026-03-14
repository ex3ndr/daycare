import { describe, expect, it } from "vitest";
import { tasksNextRunAtFind } from "./tasksNextRunAtFind";
import type { CronTriggerSummary } from "./tasksTypes";

function cron(overrides: Partial<CronTriggerSummary> = {}): CronTriggerSummary {
    return {
        id: "cron-1",
        taskId: "task-1",
        schedule: "0 * * * *",
        timezone: "UTC",
        agentId: null,
        enabled: true,
        lastExecutedAt: null,
        ...overrides
    };
}

describe("tasksNextRunAtFind", () => {
    it("returns null when no trigger can run", () => {
        const result = tasksNextRunAtFind(
            [cron({ enabled: false }), cron({ id: "cron-2", schedule: "invalid" })],
            Date.parse("2024-01-15T13:30:00.000Z")
        );

        expect(result).toBeNull();
    });

    it("returns the earliest next run", () => {
        const result = tasksNextRunAtFind(
            [
                cron({ id: "cron-1", schedule: "30 10 * * *" }),
                cron({ id: "cron-2", schedule: "0 9 * * *" }),
                cron({ id: "cron-3", schedule: "15 9 * * *" })
            ],
            Date.parse("2024-01-15T08:45:00.000Z")
        );

        expect(result).toBe(Date.parse("2024-01-15T09:00:00.000Z"));
    });
});
