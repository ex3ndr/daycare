import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosReorderInput = {
    ctx: Context;
    id: string;
    body: Record<string, unknown>;
    todos: TodosRepository;
};

export type TodosReorderResult =
    | {
          ok: true;
          todo: ReturnType<typeof todoPublicBuild>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Reorders a todo within the active workspace tree.
 * Expects: body.index is a non-negative integer.
 */
export async function todosReorder(input: TodosReorderInput): Promise<TodosReorderResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    const parentId = input.body.parentId;
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
        return { ok: false, error: "parentId must be a string or null." };
    }

    const index = typeof input.body.index === "number" ? Math.trunc(input.body.index) : Number.NaN;
    if (!Number.isFinite(index) || index < 0) {
        return { ok: false, error: "index must be a non-negative integer." };
    }

    try {
        const todo = await input.todos.reorder(input.ctx, id, typeof parentId === "string" ? parentId : null, index);
        return { ok: true, todo: todoPublicBuild(todo) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to reorder todo.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
