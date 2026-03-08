import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";

export type TodosArchiveInput = {
    ctx: Context;
    id: string;
    todos: TodosRepository;
};

export type TodosArchiveResult = { ok: true } | { ok: false; error: string };

/**
 * Archives a todo and all of its descendants.
 * Expects: id belongs to the active workspace in ctx.
 */
export async function todosArchive(input: TodosArchiveInput): Promise<TodosArchiveResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    try {
        await input.todos.archive(input.ctx, id);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to archive todo.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
