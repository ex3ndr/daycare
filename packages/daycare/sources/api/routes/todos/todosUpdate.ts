import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { TODO_STATUSES, type TodoStatus } from "../../../todos/todoTypes.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosUpdateInput = {
    ctx: Context;
    id: string;
    body: Record<string, unknown>;
    todos: TodosRepository;
};

export type TodosUpdateResult =
    | {
          ok: true;
          todo: ReturnType<typeof todoPublicBuild>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates and applies partial todo updates.
 * Expects: id belongs to the active workspace in ctx.
 */
export async function todosUpdate(input: TodosUpdateInput): Promise<TodosUpdateResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    const updates: {
        title?: string;
        description?: string | null;
        status?: TodoStatus;
    } = {};

    if (input.body.title !== undefined) {
        if (typeof input.body.title !== "string" || input.body.title.trim().length === 0) {
            return { ok: false, error: "title must be a non-empty string." };
        }
        updates.title = input.body.title.trim();
    }

    if (input.body.description !== undefined) {
        if (input.body.description !== null && typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string or null." };
        }
        updates.description = input.body.description;
    }

    if (input.body.status !== undefined) {
        if (typeof input.body.status !== "string" || !TODO_STATUSES.includes(input.body.status.trim() as TodoStatus)) {
            return { ok: false, error: `status must be one of: ${TODO_STATUSES.join(", ")}.` };
        }
        updates.status = input.body.status.trim() as TodoStatus;
    }

    if (Object.keys(updates).length === 0) {
        return { ok: false, error: "At least one field is required." };
    }

    try {
        const todo = await input.todos.update(input.ctx, id, updates);
        return { ok: true, todo: todoPublicBuild(todo) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to update todo.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
