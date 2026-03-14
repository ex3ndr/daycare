import { describe, expect, it } from "vitest";
import { tasksNextRunCacheResolve } from "./tasksNextRunCacheResolve";

describe("tasksNextRunCacheResolve", () => {
    it("reuses cached future next-run timestamps", () => {
        const now = Date.parse("2024-01-15T14:00:10.000Z");
        const cache = new Map([
            [
                "cron-1",
                {
                    schedule: "1 14 * * *",
                    timezone: "UTC",
                    enabled: true,
                    nextRunAt: Date.parse("2024-01-15T14:01:00.000Z")
                }
            ]
        ]);

        const result = tasksNextRunCacheResolve(
            [{ id: "cron-1", schedule: "1 14 * * *", timezone: "UTC", enabled: true }],
            cache,
            now
        );

        expect(result.nextRunAtById.get("cron-1")).toBe(Date.parse("2024-01-15T14:01:00.000Z"));
        expect(result.cache.get("cron-1")?.nextRunAt).toBe(Date.parse("2024-01-15T14:01:00.000Z"));
    });

    it("recomputes once the cached fire time has passed", () => {
        const now = Date.parse("2024-01-15T14:01:10.000Z");
        const cache = new Map([
            [
                "cron-1",
                {
                    schedule: "1 14 * * *",
                    timezone: "UTC",
                    enabled: true,
                    nextRunAt: Date.parse("2024-01-15T14:01:00.000Z")
                }
            ]
        ]);

        const result = tasksNextRunCacheResolve(
            [{ id: "cron-1", schedule: "1 14 * * *", timezone: "UTC", enabled: true }],
            cache,
            now
        );

        expect(result.nextRunAtById.get("cron-1")).toBe(Date.parse("2024-01-16T14:01:00.000Z"));
    });
});
