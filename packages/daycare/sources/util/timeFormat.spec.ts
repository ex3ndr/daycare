import { describe, expect, it } from "vitest";
import { formatDateAI, formatTimeAI } from "./timeFormat";

describe("formatTimeAI", () => {
    const referenceTime = new Date("2024-01-15T12:00:00Z");

    it("formats time with seconds ago", () => {
        const date = new Date("2024-01-15T11:59:30Z");
        const result = formatTimeAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("30s ago");
        expect(result).toContain("(UTC)");
    });

    it("formats time with minutes ago", () => {
        const date = new Date("2024-01-15T11:45:00Z");
        const result = formatTimeAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("15m ago");
    });

    it("formats time with hours and minutes ago", () => {
        const date = new Date("2024-01-15T09:30:00Z");
        const result = formatTimeAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2h 30m ago");
    });

    it("formats time with days ago", () => {
        const date = new Date("2024-01-13T12:00:00Z");
        const result = formatTimeAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2d ago");
    });

    it("formats future time", () => {
        const date = new Date("2024-01-15T14:30:00Z");
        const result = formatTimeAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("in 2h 30m");
    });

    it("formats with different timezone", () => {
        const date = new Date("2024-01-15T12:00:00Z");
        const result = formatTimeAI(date, {
            timezone: "America/New_York",
            referenceTime
        });
        expect(result).toContain("07:00:00");
        expect(result).toContain("EST");
    });
});

describe("formatDateAI", () => {
    const referenceTime = new Date("2024-01-15T12:00:00Z");

    it("formats today", () => {
        const date = new Date("2024-01-15T08:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2024-01-15");
        expect(result).toContain("today");
    });

    it("formats yesterday", () => {
        const date = new Date("2024-01-14T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2024-01-14");
        expect(result).toContain("yesterday");
    });

    it("formats tomorrow", () => {
        const date = new Date("2024-01-16T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2024-01-16");
        expect(result).toContain("tomorrow");
    });

    it("formats days ago", () => {
        const date = new Date("2024-01-10T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("5d ago");
    });

    it("formats weeks ago", () => {
        const date = new Date("2024-01-01T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2w");
    });

    it("formats months ago", () => {
        const date = new Date("2023-10-15T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("3mo ago");
    });

    it("formats years ago", () => {
        const date = new Date("2022-01-15T12:00:00Z");
        const result = formatDateAI(date, { timezone: "UTC", referenceTime });
        expect(result).toContain("2y ago");
    });
});
