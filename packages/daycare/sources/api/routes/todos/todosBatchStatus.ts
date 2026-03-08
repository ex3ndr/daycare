import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { TODO_STATUSES, type TodoStatus } from "../../../todos/todoTypes.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosBatchStatusInput = {
    ctx: Context;
    body: Record<string, unknown>;
    todos: TodosRepository;
};

export type TodosBatchStatusResult =
    | {
          ok: true;
          todos: Array<ReturnType<typeof todoPublicBuild>>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Updates the status of multiple todos in the active workspace.
 * Expects: body.ids is a non-empty string array and status is valid.
 */
export async function todosBatchStatus(input: TodosBatchStatusInput): Promise<TodosBatchStatusResult> {
    const ids = Array.isArray(input.body.ids) ? input.body.ids : null;
    if (!ids || ids.length === 0 || ids.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
        return { ok: false, error: "ids must be a non-empty string array." };
    }

    if (typeof input.body.status !== "string" || !TODO_STATUSES.includes(input.body.status.trim() as TodoStatus)) {
        return { ok: false, error: `status must be one of: ${TODO_STATUSES.join(", ")}.` };
    }

    try {
        const todos = await input.todos.batchUpdateStatus(
            input.ctx,
            ids.map((entry) => entry.trim()),
            input.body.status.trim() as TodoStatus
        );
        return { ok: true, todos: todos.map(todoPublicBuild) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to update todo statuses.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
