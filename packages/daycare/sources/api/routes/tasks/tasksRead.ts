import type { Context } from "@/types";
import type { TaskRecordWithTriggers } from "../routeTypes.js";

export type TasksReadInput = {
    ctx: Context;
    taskId: string;
    tasksRead: (ctx: Context, taskId: string) => Promise<TaskRecordWithTriggers | null>;
};

export type TasksReadResult =
    | {
          ok: true;
          task: TaskRecordWithTriggers["task"];
          triggers: TaskRecordWithTriggers["triggers"];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Loads one task and its trigger records.
 * Expects: taskId is non-empty.
 */
export async function tasksRead(input: TasksReadInput): Promise<TasksReadResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    const loaded = await input.tasksRead(input.ctx, taskId);
    if (!loaded) {
        return { ok: false, error: "Task not found." };
    }

    return {
        ok: true,
        task: loaded.task,
        triggers: loaded.triggers
    };
}
