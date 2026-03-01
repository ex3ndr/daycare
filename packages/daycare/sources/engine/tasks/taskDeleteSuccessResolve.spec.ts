import { describe, expect, it } from "vitest";
import { taskDeleteSuccessResolve } from "./taskDeleteSuccessResolve.js";

describe("taskDeleteSuccessResolve", () => {
    it("returns true when direct delete succeeded", () => {
        expect(taskDeleteSuccessResolve(true, { id: "task-1" })).toBe(true);
    });

    it("returns true when task is already absent after cleanup", () => {
        expect(taskDeleteSuccessResolve(false, null)).toBe(true);
    });

    it("returns false when direct delete failed and task still exists", () => {
        expect(taskDeleteSuccessResolve(false, { id: "task-1" })).toBe(false);
    });
});
