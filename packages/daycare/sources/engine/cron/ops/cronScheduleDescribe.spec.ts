import { describe, expect, it } from "vitest";

import { cronScheduleDescribe } from "./cronScheduleDescribe.js";

describe("cronScheduleDescribe", () => {
    it("returns invalid marker for invalid cron expressions", () => {
        const result = cronScheduleDescribe({ expression: "invalid", timezone: "UTC", fromAt: 0 });

        expect(result.description).toBe("Invalid cron expression.");
        expect(result.nextRunAt).toBeNull();
        expect(result.nextRunText).toBeNull();
    });

    it("describes every-minute schedules", () => {
        const result = cronScheduleDescribe({ expression: "* * * * *", timezone: "UTC", fromAt: 0 });

        expect(result.description).toBe("Every minute.");
        expect(result.nextRunAt).toBe(60_000);
        expect(result.nextRunText).toContain("in 1 minute");
    });

    it("describes weekday schedules and computes next run in timezone", () => {
        const fromAt = Date.parse("2024-01-15T13:30:00.000Z"); // Monday, 08:30 America/New_York
        const result = cronScheduleDescribe({
            expression: "0 9 * * 1-5",
            timezone: "America/New_York",
            fromAt
        });

        expect(result.description).toBe("On Monday through Friday at 09:00.");
        expect(result.nextRunAt).toBe(Date.parse("2024-01-15T14:00:00.000Z"));
        expect(result.nextRunText).toContain("in 30 minutes");
    });

    it("uses fallback text for complex expressions", () => {
        const result = cronScheduleDescribe({ expression: "5 0,12 1-10 1,6 *", timezone: "UTC", fromAt: 0 });

        expect(result.description).toContain("Runs when minute is 05");
        expect(result.description).toContain("hour is 00 and 12");
        expect(result.description).toContain("month is January and June");
    });
});
