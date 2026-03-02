import { describe, expect, it } from "vitest";
import { tasksSubtitle } from "./tasksSubtitle";
import type { CronTriggerSummary, WebhookTriggerSummary } from "./tasksTypes";

function cron(overrides: Partial<CronTriggerSummary> = {}): CronTriggerSummary {
    return {
        id: "c1",
        taskId: "t1",
        schedule: "0 * * * *",
        timezone: "UTC",
        agentId: null,
        enabled: true,
        lastExecutedAt: null,
        ...overrides
    };
}

function webhook(overrides: Partial<WebhookTriggerSummary> = {}): WebhookTriggerSummary {
    return {
        id: "w1",
        taskId: "t1",
        agentId: null,
        lastExecutedAt: null,
        ...overrides
    };
}

describe("tasksSubtitle", () => {
    it("shows cron schedule", () => {
        const result = tasksSubtitle([cron({ schedule: "0 9 * * 1-5" })], []);
        expect(result).toBe("0 9 * * 1-5");
    });

    it("shows timezone when not UTC", () => {
        const result = tasksSubtitle([cron({ schedule: "0 9 * * *", timezone: "America/New_York" })], []);
        expect(result).toBe("0 9 * * * (America/New_York)");
    });

    it("shows webhook count", () => {
        const result = tasksSubtitle([], [webhook()]);
        expect(result).toBe("1 webhook");
    });

    it("pluralizes webhooks", () => {
        const result = tasksSubtitle([], [webhook({ id: "w1" }), webhook({ id: "w2" })]);
        expect(result).toBe("2 webhooks");
    });

    it("combines cron and webhooks", () => {
        const result = tasksSubtitle(
            [cron({ schedule: "*/5 * * * *" })],
            [webhook({ id: "w1" }), webhook({ id: "w2" })]
        );
        expect(result).toBe("*/5 * * * * · 2 webhooks");
    });

    it("shows multiple cron schedules", () => {
        const result = tasksSubtitle(
            [cron({ id: "c1", schedule: "0 9 * * *" }), cron({ id: "c2", schedule: "0 17 * * *" })],
            []
        );
        expect(result).toBe("0 9 * * * · 0 17 * * *");
    });

    it("shows no triggers text when empty", () => {
        const result = tasksSubtitle([], []);
        expect(result).toBe("No triggers");
    });
});
