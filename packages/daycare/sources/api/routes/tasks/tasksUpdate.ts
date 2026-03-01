import type { Context } from "@/types";
import type { TaskUpdateInput } from "../routeTypes.js";
import { tasksParameterParse } from "./tasksParameterParse.js";

export type TasksUpdateHandlerInput = {
    ctx: Context;
    taskId: string;
    body: Record<string, unknown>;
    tasksUpdate: (
        ctx: Context,
        taskId: string,
        input: TaskUpdateInput
    ) => Promise<{
        id: string;
        title: string;
        description: string | null;
        code: string;
        parameters: TaskUpdateInput["parameters"];
        createdAt: number;
        updatedAt: number;
    } | null>;
};

export type TasksUpdateResult =
    | {
          ok: true;
          task: {
              id: string;
              title: string;
              description: string | null;
              code: string;
              parameters: TaskUpdateInput["parameters"];
              createdAt: number;
              updatedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates task update payload and applies partial task updates.
 * Expects: taskId is non-empty and at least one mutable field is provided.
 */
export async function tasksUpdate(input: TasksUpdateHandlerInput): Promise<TasksUpdateResult> {
    const taskId = input.taskId.trim();
    if (!taskId) {
        return { ok: false, error: "taskId is required." };
    }

    const updates: TaskUpdateInput = {};

    if (input.body.title !== undefined) {
        if (typeof input.body.title !== "string" || input.body.title.trim().length === 0) {
            return { ok: false, error: "title must be a non-empty string." };
        }
        updates.title = input.body.title.trim();
    }

    if (input.body.code !== undefined) {
        if (typeof input.body.code !== "string" || input.body.code.trim().length === 0) {
            return { ok: false, error: "code must be a non-empty string." };
        }
        updates.code = input.body.code;
    }

    if (input.body.description !== undefined) {
        if (input.body.description !== null && typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string or null." };
        }
        updates.description = input.body.description;
    }

    if (input.body.parameters !== undefined) {
        const parsed = tasksParameterParse(input.body.parameters);
        if (!parsed.ok) {
            return parsed;
        }
        updates.parameters = parsed.parameters;
    }

    if (Object.keys(updates).length === 0) {
        return { ok: false, error: "At least one field is required." };
    }

    try {
        const task = await input.tasksUpdate(input.ctx, taskId, updates);
        if (!task) {
            return { ok: false, error: "Task not found." };
        }
        return {
            ok: true,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                code: task.code,
                parameters: task.parameters,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update task.";
        return { ok: false, error: message };
    }
}
