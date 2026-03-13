import type { Context } from "@/types";

export type TasksTriggerUpdateInput = {
    ctx: Context;
    taskId: string;
    triggerId: string;
    body: Record<string, unknown>;
    cronTriggerUpdate: (
        ctx: Context,
        taskId: string,
        triggerId: string,
        input: { enabled?: boolean }
    ) => Promise<{
        id: string;
        taskId: string;
        schedule: string;
        timezone: string;
        agentId: string | null;
        enabled: boolean;
        deleteAfterRun: boolean;
        parameters: Record<string, unknown> | null;
        lastRunAt: number | null;
        createdAt: number;
        updatedAt: number;
    } | null>;
};

export type TasksTriggerUpdateResult =
    | {
          ok: true;
          trigger: {
              id: string;
              type: "cron";
              taskId: string;
              schedule: string;
              timezone: string;
              agentId: string | null;
              enabled: boolean;
              deleteAfterRun: boolean;
              parameters: Record<string, unknown> | null;
              lastRunAt: number | null;
              createdAt: number;
              updatedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Updates mutable trigger fields for an existing task trigger.
 * Expects: taskId and triggerId are non-empty; currently only cron `enabled` is mutable.
 */
export async function tasksTriggerUpdate(input: TasksTriggerUpdateInput): Promise<TasksTriggerUpdateResult> {
    const taskId = input.taskId.trim();
    const triggerId = input.triggerId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }
    if (!triggerId) {
        return { ok: false, error: "triggerId is required." };
    }

    const updates: { enabled?: boolean } = {};
    if (input.body.enabled !== undefined) {
        if (typeof input.body.enabled !== "boolean") {
            return { ok: false, error: "enabled must be a boolean." };
        }
        updates.enabled = input.body.enabled;
    }

    if (Object.keys(updates).length === 0) {
        return { ok: false, error: "At least one mutable trigger field is required." };
    }

    try {
        const trigger = await input.cronTriggerUpdate(input.ctx, taskId, triggerId, updates);
        if (!trigger) {
            return { ok: false, error: "Trigger not found." };
        }
        return {
            ok: true,
            trigger: {
                id: trigger.id,
                type: "cron",
                taskId: trigger.taskId,
                schedule: trigger.schedule,
                timezone: trigger.timezone,
                agentId: trigger.agentId,
                enabled: trigger.enabled,
                deleteAfterRun: trigger.deleteAfterRun,
                parameters: trigger.parameters,
                lastRunAt: trigger.lastRunAt,
                createdAt: trigger.createdAt,
                updatedAt: trigger.updatedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update trigger.";
        return { ok: false, error: message };
    }
}
