import { describe, expect, it } from "vitest";
import { tasksFormatNextRun } from "./tasksFormatNextRun";

describe("tasksFormatNextRun", () => {
    it("returns 'not scheduled' for null", () => {
        expect(tasksFormatNextRun(null)).toBe("not scheduled");
    });

    it("formats the exact timestamp in the requested timezone", () => {
        const result = tasksFormatNextRun(Date.parse("2024-01-15T14:00:00.000Z"), "America/Los_Angeles");

        expect(result).toBe("Jan 15, 2024, 06:00:00 AM PST");
    });
});
