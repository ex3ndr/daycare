import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosTreeInput = {
    ctx: Context;
    query: URLSearchParams;
    todos: TodosRepository;
};

export type TodosTreeResult =
    | {
          ok: true;
          todos: Array<ReturnType<typeof todoPublicBuild>>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Returns a flat preordered todo tree for client-side assembly.
 * Expects: depth is omitted, "all", or a non-negative integer.
 */
export async function todosTree(input: TodosTreeInput): Promise<TodosTreeResult> {
    const workspaceId = input.query.get("workspaceId");
    if (workspaceId && workspaceId.trim() !== input.ctx.userId) {
        return { ok: false, error: "workspaceId must match the authenticated workspace." };
    }

    const rootId = input.query.get("rootId")?.trim() || undefined;
    const depthValue = input.query.get("depth")?.trim();
    let depth: number | undefined;
    if (depthValue && depthValue !== "all") {
        depth = Number.parseInt(depthValue, 10);
        if (!Number.isFinite(depth) || depth < 0) {
            return { ok: false, error: "depth must be a non-negative integer or 'all'." };
        }
    }

    try {
        const todos = await input.todos.findTree(input.ctx, rootId, depth);
        return { ok: true, todos: todos.map(todoPublicBuild) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to load todo tree.") };
    }
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
