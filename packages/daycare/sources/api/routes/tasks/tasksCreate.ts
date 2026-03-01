import type { Context } from "@/types";
import type { TaskCreateInput } from "../routeTypes.js";
import { tasksParameterParse } from "./tasksParameterParse.js";

export type TasksCreateHandlerInput = {
    ctx: Context;
    body: Record<string, unknown>;
    tasksCreate: (
        ctx: Context,
        input: TaskCreateInput
    ) => Promise<{
        id: string;
        title: string;
        description: string | null;
        code: string;
        parameters: TaskCreateInput["parameters"];
        createdAt: number;
        updatedAt: number;
    }>;
};

export type TasksCreateResult =
    | {
          ok: true;
          task: {
              id: string;
              title: string;
              description: string | null;
              code: string;
              parameters: TaskCreateInput["parameters"];
              createdAt: number;
              updatedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates task create payload and persists a new task.
 * Expects: title/code are non-empty strings.
 */
export async function tasksCreate(input: TasksCreateHandlerInput): Promise<TasksCreateResult> {
    const title = typeof input.body.title === "string" ? input.body.title.trim() : "";
    const code = typeof input.body.code === "string" ? input.body.code : "";

    if (!title) {
        return { ok: false, error: "title is required." };
    }
    if (!code.trim()) {
        return { ok: false, error: "code is required." };
    }

    let description: string | null | undefined;
    if (input.body.description !== undefined) {
        if (input.body.description !== null && typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string or null." };
        }
        description = input.body.description;
    }

    let parameters: TaskCreateInput["parameters"];
    if (input.body.parameters !== undefined) {
        const parsed = tasksParameterParse(input.body.parameters);
        if (!parsed.ok) {
            return parsed;
        }
        parameters = parsed.parameters;
    }

    try {
        const task = await input.tasksCreate(input.ctx, {
            title,
            code,
            ...(description !== undefined ? { description } : {}),
            ...(parameters !== undefined ? { parameters } : {})
        });

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
        const message = error instanceof Error ? error.message : "Failed to create task.";
        return { ok: false, error: message };
    }
}
