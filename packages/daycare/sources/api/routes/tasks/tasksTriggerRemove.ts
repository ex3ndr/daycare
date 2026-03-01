import type { Context } from "@/types";

export type TasksTriggerRemoveInput = {
    ctx: Context;
    taskId: string;
    body: Record<string, unknown>;
    cronTriggerRemove: (ctx: Context, taskId: string) => Promise<number>;
    webhookTriggerRemove: (ctx: Context, taskId: string) => Promise<number>;
};

export type TasksTriggerRemoveResult =
    | {
          ok: true;
          removed: number;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Removes cron or webhook triggers for a task.
 * Expects: body.type is "cron" or "webhook".
 */
export async function tasksTriggerRemove(input: TasksTriggerRemoveInput): Promise<TasksTriggerRemoveResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    const type = input.body.type;
    if (type !== "cron" && type !== "webhook") {
        return { ok: false, error: "type must be cron or webhook." };
    }

    try {
        const removed =
            type === "cron"
                ? await input.cronTriggerRemove(input.ctx, taskId)
                : await input.webhookTriggerRemove(input.ctx, taskId);
        return { ok: true, removed };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove triggers.";
        return { ok: false, error: message };
    }
}
