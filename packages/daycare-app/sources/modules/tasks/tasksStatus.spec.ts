import { describe, expect, it } from "vitest";
import { tasksStatus } from "./tasksStatus";
import type { TaskSummary } from "./tasksTypes";

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
    return {
        id: "t1",
        title: "Test Task",
        description: null,
        createdAt: 1000,
        updatedAt: 2000,
        lastExecutedAt: null,
        ...overrides
    };
}

describe("tasksStatus", () => {
    it("returns ok when task has been executed", () => {
        expect(tasksStatus(task({ lastExecutedAt: 5000 }))).toBe("ok");
    });

    it("returns warning when task has never been executed", () => {
        expect(tasksStatus(task({ lastExecutedAt: null }))).toBe("warning");
    });
});
