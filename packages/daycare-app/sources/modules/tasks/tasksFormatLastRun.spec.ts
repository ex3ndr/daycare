import { describe, expect, it } from "vitest";
import { tasksFormatLastRun } from "./tasksFormatLastRun";

const NOW = 1_700_000_000_000;

describe("tasksFormatLastRun", () => {
    it("returns 'never' for null", () => {
        expect(tasksFormatLastRun(null, NOW)).toBe("never");
    });

    it("returns 'just now' for recent execution", () => {
        expect(tasksFormatLastRun(NOW - 30_000, NOW)).toBe("just now");
    });

    it("returns minutes ago", () => {
        expect(tasksFormatLastRun(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    });

    it("returns hours ago", () => {
        expect(tasksFormatLastRun(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    });

    it("returns days ago", () => {
        expect(tasksFormatLastRun(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
    });

    it("returns 'just now' for future timestamp", () => {
        expect(tasksFormatLastRun(NOW + 10_000, NOW)).toBe("just now");
    });
});
