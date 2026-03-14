import { describe, expect, it } from "vitest";
import { tasksSortByNextRun } from "./tasksSortByNextRun";
import type { CronTriggerSummary, TaskSummary } from "./tasksTypes";

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

function cron(taskId: string, schedule: string, enabled = true): CronTriggerSummary {
    return {
        id: `cron-${taskId}-${schedule}`,
        taskId,
        schedule,
        timezone: "UTC",
        agentId: null,
        enabled,
        lastExecutedAt: null
    };
}

describe("tasksSortByNextRun", () => {
    it("sorts tasks by earliest next run and keeps unscheduled tasks last", () => {
        const tasks = [
            task({ id: "later", title: "Later" }),
            task({ id: "none", title: "None" }),
            task({ id: "soon", title: "Soon" })
        ];
        const cronByTask = new Map<string, CronTriggerSummary[]>([
            ["later", [cron("later", "30 10 * * *")]],
            ["none", [cron("none", "0 9 * * *", false)]],
            ["soon", [cron("soon", "0 9 * * *")]]
        ]);

        const result = tasksSortByNextRun(tasks, cronByTask, Date.parse("2024-01-15T08:45:00.000Z"));

        expect(result.map((entry) => entry.id)).toEqual(["soon", "later", "none"]);
    });
});
