import { describe, expect, it } from "vitest";

import { taskIdIsSafe } from "./taskIdIsSafe.js";

describe("taskIdIsSafe", () => {
    it("accepts alphanumeric characters", () => {
        expect(taskIdIsSafe("abc123")).toBe(true);
        expect(taskIdIsSafe("ABC")).toBe(true);
    });

    it("accepts dots, underscores, and hyphens", () => {
        expect(taskIdIsSafe("my-task")).toBe(true);
        expect(taskIdIsSafe("my_task")).toBe(true);
        expect(taskIdIsSafe("my.task")).toBe(true);
        expect(taskIdIsSafe("my-task_v2.0")).toBe(true);
    });

    it("rejects spaces", () => {
        expect(taskIdIsSafe("my task")).toBe(false);
        expect(taskIdIsSafe(" task")).toBe(false);
    });

    it("rejects special characters", () => {
        expect(taskIdIsSafe("task!")).toBe(false);
        expect(taskIdIsSafe("task@home")).toBe(false);
        expect(taskIdIsSafe("task/path")).toBe(false);
        expect(taskIdIsSafe("task\\path")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(taskIdIsSafe("")).toBe(false);
    });
});
