import { describe, expect, it } from "vitest";
import { tasksCronNextRunAtResolve } from "./tasksCronNextRunAtResolve";

describe("tasksCronNextRunAtResolve", () => {
    it("returns null for disabled triggers", () => {
        const result = tasksCronNextRunAtResolve({
            schedule: "0 9 * * *",
            timezone: "UTC",
            enabled: false,
            fromAt: 0
        });

        expect(result).toBeNull();
    });

    it("returns the next matching timestamp in the cron timezone", () => {
        const result = tasksCronNextRunAtResolve({
            schedule: "0 9 * * 1-5",
            timezone: "America/New_York",
            enabled: true,
            fromAt: Date.parse("2024-01-15T13:30:00.000Z")
        });

        expect(result).toBe(Date.parse("2024-01-15T14:00:00.000Z"));
    });

    it("returns null for invalid schedules", () => {
        const result = tasksCronNextRunAtResolve({
            schedule: "invalid",
            timezone: "UTC",
            enabled: true,
            fromAt: 0
        });

        expect(result).toBeNull();
    });
});
