import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosListInput = {
    ctx: Context;
    query: URLSearchParams;
    todos: TodosRepository;
};

export type TodosListResult =
    | {
          ok: true;
          todos: Array<ReturnType<typeof todoPublicBuild>>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Lists root todos or children for a parent within the active workspace.
 * Expects: optional workspaceId query matches ctx.userId when present.
 */
export async function todosList(input: TodosListInput): Promise<TodosListResult> {
    const workspaceId = input.query.get("workspaceId");
    if (workspaceId && workspaceId.trim() !== input.ctx.userId) {
        return { ok: false, error: "workspaceId must match the authenticated workspace." };
    }

    const parentId = input.query.get("parentId");
    try {
        const todos = parentId?.trim()
            ? await input.todos.findByParent(input.ctx, parentId)
            : await input.todos.findRoots(input.ctx);
        return { ok: true, todos: todos.map(todoPublicBuild) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to list todos.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
