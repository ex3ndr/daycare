import type { Context } from "@/types";
import { cronExpressionParse } from "../../../engine/cron/ops/cronExpressionParse.js";
import { cronTimezoneResolve } from "../../../engine/cron/ops/cronTimezoneResolve.js";
import type { CronTriggerAddInput, WebhookTriggerAddInput } from "../routeTypes.js";

export type TasksTriggerAddInput = {
    ctx: Context;
    taskId: string;
    body: Record<string, unknown>;
    cronTriggerAdd: (
        ctx: Context,
        taskId: string,
        input: CronTriggerAddInput
    ) => Promise<{
        id: string;
        taskId: string;
        schedule: string;
        timezone: string;
        agentId: string | null;
        parameters: Record<string, unknown> | null;
        lastRunAt: number | null;
        createdAt: number;
        updatedAt: number;
    }>;
    webhookTriggerAdd: (
        ctx: Context,
        taskId: string,
        input: WebhookTriggerAddInput
    ) => Promise<{
        id: string;
        taskId: string;
        agentId: string | null;
        lastRunAt: number | null;
        createdAt: number;
        updatedAt: number;
    }>;
};

export type TasksTriggerAddResult =
    | {
          ok: true;
          trigger:
              | {
                    id: string;
                    type: "cron";
                    taskId: string;
                    schedule: string;
                    timezone: string;
                    agentId: string | null;
                    parameters: Record<string, unknown> | null;
                    lastRunAt: number | null;
                    createdAt: number;
                    updatedAt: number;
                }
              | {
                    id: string;
                    type: "webhook";
                    taskId: string;
                    agentId: string | null;
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
 * Adds a cron or webhook trigger to an existing task.
 * Expects: body.type is "cron" or "webhook" and cron payloads include a valid schedule.
 */
export async function tasksTriggerAdd(input: TasksTriggerAddInput): Promise<TasksTriggerAddResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    const type = input.body.type;
    if (type !== "cron" && type !== "webhook") {
        return { ok: false, error: "type must be cron or webhook." };
    }

    const agentId = optionalStringValue(input.body.agentId, "agentId");
    if (agentId.error) {
        return { ok: false, error: agentId.error };
    }

    if (type === "cron") {
        if (typeof input.body.schedule !== "string" || input.body.schedule.trim().length === 0) {
            return { ok: false, error: "schedule is required for cron triggers." };
        }
        const schedule = input.body.schedule.trim();
        if (!cronExpressionParse(schedule)) {
            return { ok: false, error: "schedule must be a valid 5-field cron expression." };
        }

        const timezoneResult = optionalStringValue(input.body.timezone, "timezone", { allowEmpty: true });
        if (timezoneResult.error) {
            return { ok: false, error: timezoneResult.error };
        }

        const parameters = optionalRecordValue(input.body.parameters, "parameters");
        if (parameters.error) {
            return { ok: false, error: parameters.error };
        }

        try {
            const timezone = cronTimezoneResolve({ timezone: timezoneResult.value });
            const trigger = await input.cronTriggerAdd(input.ctx, taskId, {
                schedule,
                timezone,
                ...(agentId.value ? { agentId: agentId.value } : {}),
                ...(parameters.value ? { parameters: parameters.value } : {})
            });
            return {
                ok: true,
                trigger: {
                    id: trigger.id,
                    type: "cron",
                    taskId: trigger.taskId,
                    schedule: trigger.schedule,
                    timezone: trigger.timezone,
                    agentId: trigger.agentId,
                    parameters: trigger.parameters,
                    lastRunAt: trigger.lastRunAt,
                    createdAt: trigger.createdAt,
                    updatedAt: trigger.updatedAt
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to add cron trigger.";
            return { ok: false, error: message };
        }
    }

    try {
        const trigger = await input.webhookTriggerAdd(input.ctx, taskId, {
            ...(agentId.value ? { agentId: agentId.value } : {})
        });
        return {
            ok: true,
            trigger: {
                id: trigger.id,
                type: "webhook",
                taskId: trigger.taskId,
                agentId: trigger.agentId,
                lastRunAt: trigger.lastRunAt,
                createdAt: trigger.createdAt,
                updatedAt: trigger.updatedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add webhook trigger.";
        return { ok: false, error: message };
    }
}

function optionalStringValue(
    value: unknown,
    field: string,
    options: { allowEmpty?: boolean } = {}
): { value?: string; error?: string } {
    if (value === undefined) {
        return {};
    }
    if (typeof value !== "string") {
        return { error: `${field} must be a string.` };
    }
    const trimmed = value.trim();
    if (!options.allowEmpty && trimmed.length === 0) {
        return { error: `${field} must be a non-empty string.` };
    }
    return trimmed.length > 0 ? { value: trimmed } : {};
}

function optionalRecordValue(value: unknown, field: string): { value?: Record<string, unknown>; error?: string } {
    if (value === undefined) {
        return {};
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return { error: `${field} must be an object.` };
    }
    return { value: value as Record<string, unknown> };
}
