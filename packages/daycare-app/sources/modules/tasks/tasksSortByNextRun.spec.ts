import { describe, expect, it } from "vitest";
import { tasksSortByNextRun } from "./tasksSortByNextRun";
import type { TaskSummary } from "./tasksTypes";

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
    return {
        id: "task-1",
        title: "Task 1",
        description: null,
        parameters: null,
        createdAt: 1,
        updatedAt: 1,
        lastExecutedAt: null,
        ...overrides
    };
}

describe("tasksSortByNextRun", () => {
    it("sorts tasks by earliest next run and keeps unscheduled tasks last", () => {
        const tasks = [
            task({ id: "later", title: "Later" }),
            task({ id: "none", title: "None" }),
            task({ id: "soon", title: "Soon" })
        ];
        const nextRunAtByTask = new Map<string, number | null>([
            ["later", Date.parse("2024-01-15T10:30:00.000Z")],
            ["none", null],
            ["soon", Date.parse("2024-01-15T09:00:00.000Z")]
        ]);

        const result = tasksSortByNextRun(tasks, nextRunAtByTask);

        expect(result.map((entry) => entry.id)).toEqual(["soon", "later", "none"]);
    });
});
