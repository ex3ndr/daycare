import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { TODO_STATUSES, type TodoStatus } from "../../../todos/todoTypes.js";
import { todoPublicBuild } from "./todoPublicBuild.js";

export type TodosCreateInput = {
    ctx: Context;
    body: Record<string, unknown>;
    todos: TodosRepository;
};

export type TodosCreateResult =
    | {
          ok: true;
          todo: ReturnType<typeof todoPublicBuild>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates and creates a workspace-scoped todo.
 * Expects: ctx.userId is the active workspace user id.
 */
export async function todosCreate(input: TodosCreateInput): Promise<TodosCreateResult> {
    const workspaceError = workspaceScopeValidate(input.ctx, input.body.workspaceId);
    if (workspaceError) {
        return { ok: false, error: workspaceError };
    }

    const title = typeof input.body.title === "string" ? input.body.title.trim() : "";
    if (!title) {
        return { ok: false, error: "title is required." };
    }

    const description = input.body.description;
    if (description !== undefined && description !== null && typeof description !== "string") {
        return { ok: false, error: "description must be a string or null." };
    }

    const parentId = input.body.parentId;
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
        return { ok: false, error: "parentId must be a string or null." };
    }

    const status = statusOptionalRead(input.body.status);
    if (!status.ok) {
        return status;
    }

    try {
        const todo = await input.todos.create(input.ctx, {
            title,
            description: typeof description === "string" ? description : null,
            parentId: typeof parentId === "string" ? parentId : null,
            status: status.value
        });
        return { ok: true, todo: todoPublicBuild(todo) };
    } catch (error) {
        return { ok: false, error: errorMessageResolve(error, "Failed to create todo.") };
    }
}

function workspaceScopeValidate(ctx: Context, workspaceId: unknown): string | null {
    if (workspaceId === undefined) {
        return null;
    }
    if (typeof workspaceId !== "string" || workspaceId.trim() !== ctx.userId) {
        return "workspaceId must match the authenticated workspace.";
    }
    return null;
}

function statusOptionalRead(value: unknown): { ok: true; value?: TodoStatus } | { ok: false; error: string } {
    if (value === undefined) {
        return { ok: true };
    }
    if (typeof value !== "string" || !TODO_STATUSES.includes(value.trim() as TodoStatus)) {
        return { ok: false, error: `status must be one of: ${TODO_STATUSES.join(", ")}.` };
    }
    return { ok: true, value: value.trim() as TodoStatus };
}

function errorMessageResolve(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
