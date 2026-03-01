import type { Context } from "@/types";
import type { TaskRunInput, TaskRunResult } from "../routeTypes.js";

export type TasksRunHandlerInput = {
    ctx: Context;
    taskId: string;
    body: Record<string, unknown>;
    tasksRun: (ctx: Context, taskId: string, input: TaskRunInput) => Promise<TaskRunResult>;
};

export type TasksRunResult =
    | {
          ok: true;
          output: string;
      }
    | {
          ok: true;
          queued: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates and dispatches a manual task run.
 * Expects: taskId is non-empty and parameters, when provided, are an object.
 */
export async function tasksRun(input: TasksRunHandlerInput): Promise<TasksRunResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    const runInput: TaskRunInput = {};

    if (input.body.agentId !== undefined) {
        if (typeof input.body.agentId !== "string" || input.body.agentId.trim().length === 0) {
            return { ok: false, error: "agentId must be a non-empty string." };
        }
        runInput.agentId = input.body.agentId.trim();
    }

    if (input.body.parameters !== undefined) {
        if (!recordValueIs(input.body.parameters)) {
            return { ok: false, error: "parameters must be an object." };
        }
        runInput.parameters = input.body.parameters;
    }

    if (input.body.sync !== undefined) {
        if (typeof input.body.sync !== "boolean") {
            return { ok: false, error: "sync must be a boolean." };
        }
        runInput.sync = input.body.sync;
    }

    try {
        const result = await input.tasksRun(input.ctx, taskId, runInput);
        if ("output" in result) {
            return { ok: true, output: result.output };
        }
        return { ok: true, queued: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run task.";
        return { ok: false, error: message };
    }
}

function recordValueIs(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
