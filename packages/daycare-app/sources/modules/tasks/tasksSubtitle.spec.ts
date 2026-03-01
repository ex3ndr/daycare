import { describe, expect, it } from "vitest";
import { tasksSubtitle } from "./tasksSubtitle";
import type { TaskActiveSummary } from "./tasksTypes";

function task(overrides: Partial<TaskActiveSummary> = {}): TaskActiveSummary {
    return {
        id: "t1",
        title: "Test",
        description: null,
        createdAt: 0,
        updatedAt: 0,
        lastExecutedAt: null,
        triggers: { cron: [], webhook: [] },
        ...overrides
    };
}

describe("tasksSubtitle", () => {
    it("shows cron schedule", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [{ id: "c1", schedule: "0 9 * * 1-5", timezone: "UTC", agentId: null, lastExecutedAt: null }],
                    webhook: []
                }
            })
        );
        expect(result).toBe("0 9 * * 1-5");
    });

    it("shows timezone when not UTC", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [
                        {
                            id: "c1",
                            schedule: "0 9 * * *",
                            timezone: "America/New_York",
                            agentId: null,
                            lastExecutedAt: null
                        }
                    ],
                    webhook: []
                }
            })
        );
        expect(result).toBe("0 9 * * * (America/New_York)");
    });

    it("shows webhook count", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [],
                    webhook: [{ id: "w1", agentId: null, lastExecutedAt: null }]
                }
            })
        );
        expect(result).toBe("1 webhook");
    });

    it("pluralizes webhooks", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [],
                    webhook: [
                        { id: "w1", agentId: null, lastExecutedAt: null },
                        { id: "w2", agentId: null, lastExecutedAt: null }
                    ]
                }
            })
        );
        expect(result).toBe("2 webhooks");
    });

    it("combines cron and webhooks", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [{ id: "c1", schedule: "*/5 * * * *", timezone: "UTC", agentId: null, lastExecutedAt: null }],
                    webhook: [
                        { id: "w1", agentId: null, lastExecutedAt: null },
                        { id: "w2", agentId: null, lastExecutedAt: null }
                    ]
                }
            })
        );
        expect(result).toBe("*/5 * * * * · 2 webhooks");
    });

    it("shows multiple cron schedules", () => {
        const result = tasksSubtitle(
            task({
                triggers: {
                    cron: [
                        { id: "c1", schedule: "0 9 * * *", timezone: "UTC", agentId: null, lastExecutedAt: null },
                        { id: "c2", schedule: "0 17 * * *", timezone: "UTC", agentId: null, lastExecutedAt: null }
                    ],
                    webhook: []
                }
            })
        );
        expect(result).toBe("0 9 * * * · 0 17 * * *");
    });
});
