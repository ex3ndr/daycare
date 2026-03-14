import { describe, expect, it } from "vitest";
import { tasksNowDelayResolve } from "./tasksNowDelayResolve";

describe("tasksNowDelayResolve", () => {
    it("refreshes on the next second boundary when the next fire is within a minute", () => {
        const now = Date.parse("2024-01-15T14:00:10.250Z");
        const result = tasksNowDelayResolve([Date.parse("2024-01-15T14:01:00.000Z")], now);

        expect(result).toBe(750);
    });

    it("refreshes on the next minute boundary when the next fire is within a day", () => {
        const now = Date.parse("2024-01-15T14:00:10.250Z");
        const result = tasksNowDelayResolve([Date.parse("2024-01-15T14:30:00.000Z")], now);

        expect(result).toBe(49_750);
    });

    it("refreshes on the next hour boundary when the next fire is more than a day away", () => {
        const now = Date.parse("2024-01-15T14:00:10.250Z");
        const result = tasksNowDelayResolve([Date.parse("2024-01-18T09:00:00.000Z")], now);

        expect(result).toBe(3_589_750);
    });

    it("falls back to hourly refresh when nothing is scheduled", () => {
        const now = Date.parse("2024-01-15T14:00:10.250Z");
        const result = tasksNowDelayResolve([null], now);

        expect(result).toBe(3_589_750);
    });
});
