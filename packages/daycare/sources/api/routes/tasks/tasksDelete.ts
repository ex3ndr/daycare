import type { Context } from "@/types";

export type TasksDeleteInput = {
    ctx: Context;
    taskId: string;
    tasksDelete: (ctx: Context, taskId: string) => Promise<boolean>;
};

export type TasksDeleteResult =
    | {
          ok: true;
          deleted: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Deletes one task and returns a simple deletion status.
 * Expects: taskId is non-empty.
 */
export async function tasksDelete(input: TasksDeleteInput): Promise<TasksDeleteResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    try {
        const deleted = await input.tasksDelete(input.ctx, taskId);
        if (!deleted) {
            return { ok: false, error: "Task not found." };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete task.";
        return { ok: false, error: message };
    }

    return { ok: true, deleted: true };
}
