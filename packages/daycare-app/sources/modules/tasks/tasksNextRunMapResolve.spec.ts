import { describe, expect, it } from "vitest";
import { tasksNextRunMapResolve } from "./tasksNextRunMapResolve";

describe("tasksNextRunMapResolve", () => {
    it("resolves each trigger once and keeps disabled triggers unscheduled", () => {
        const now = Date.parse("2024-01-15T13:30:00.000Z");
        const result = tasksNextRunMapResolve(
            [
                { id: "soon", schedule: "0 9 * * *", timezone: "UTC", enabled: true },
                { id: "disabled", schedule: "0 9 * * *", timezone: "UTC", enabled: false }
            ],
            now
        );

        expect(result.get("soon")).toBe(Date.parse("2024-01-16T09:00:00.000Z"));
        expect(result.get("disabled")).toBeNull();
    });
});
