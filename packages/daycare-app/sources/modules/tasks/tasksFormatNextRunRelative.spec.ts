import { describe, expect, it } from "vitest";
import { tasksFormatNextRunRelative } from "./tasksFormatNextRunRelative";

const NOW = Date.parse("2024-01-15T14:00:00.000Z");

describe("tasksFormatNextRunRelative", () => {
    it("returns 'not scheduled' for null", () => {
        expect(tasksFormatNextRunRelative(null, NOW)).toBe("not scheduled");
    });

    it("formats seconds", () => {
        expect(tasksFormatNextRunRelative(NOW + 45_000, NOW)).toBe("in 45 seconds");
    });

    it("formats minutes and seconds", () => {
        expect(tasksFormatNextRunRelative(NOW + 125_000, NOW)).toBe("in 2 minutes 5 seconds");
    });

    it("formats hours and minutes", () => {
        expect(tasksFormatNextRunRelative(NOW + (2 * 3_600_000 + 15 * 60_000), NOW)).toBe("in 2 hours 15 minutes");
    });

    it("formats days and hours", () => {
        expect(tasksFormatNextRunRelative(NOW + (3 * 86_400_000 + 4 * 3_600_000), NOW)).toBe("in 3 days 4 hours");
    });
});
