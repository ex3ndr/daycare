import { getByPath, type StateModel, type StateStore } from "@json-render/core";
import type { ExperimentsTodoDb } from "./experimentsTodoDb";
import { experimentsTodoStateBuild } from "./experimentsTodoStateBuild";
import type { ExperimentsTodo } from "./experimentsTodoTypes";

type ExperimentsTodoHandlersBuildInput = {
    dbResolve: () => ExperimentsTodoDb | null;
    stateStore: StateStore;
};

type JsonActionHandler = (params: Record<string, unknown>) => Promise<void>;

/**
 * Builds json-render action handlers for create/toggle/delete todo operations.
 * Expects: params.index (for row actions) is provided via `$index` in repeat scopes.
 */
export function experimentsTodoHandlersBuild(
    input: ExperimentsTodoHandlersBuildInput
): Record<string, JsonActionHandler> {
    async function refreshTodos(db: ExperimentsTodoDb): Promise<void> {
        const todos = await db.list();
        input.stateStore.update({
            ...experimentsTodoStateBuild(todos),
            "/loading": false,
            "/ready": true,
            "/error": null
        });
    }

    async function runMutation(mutation: (db: ExperimentsTodoDb) => Promise<void>): Promise<void> {
        const db = input.dbResolve();
        if (!db) {
            input.stateStore.set("/error", "Todo database is not ready yet.");
            return;
        }

        input.stateStore.set("/loading", true);
        try {
            await mutation(db);
            await refreshTodos(db);
        } catch (error) {
            input.stateStore.update({
                "/loading": false,
                "/error": error instanceof Error ? error.message : "Todo action failed."
            });
        }
    }

    return {
        todoCreate: async (params) => {
            const title = typeof params.title === "string" ? params.title.trim() : "";
            if (!title) {
                return;
            }

            await runMutation(async (db) => {
                await db.create(title);
                input.stateStore.set("/draft/title", "");
            });
        },
        todoToggle: async (params) => {
            const index = indexExtract(params);
            if (index === null) {
                return;
            }

            const todo = todoAtIndex(input.stateStore.getSnapshot(), index);
            if (!todo) {
                return;
            }

            await runMutation(async (db) => {
                await db.toggle(todo.id, !todo.done);
            });
        },
        todoDelete: async (params) => {
            const index = indexExtract(params);
            if (index === null) {
                return;
            }

            const todo = todoAtIndex(input.stateStore.getSnapshot(), index);
            if (!todo) {
                return;
            }

            await runMutation(async (db) => {
                await db.remove(todo.id);
            });
        }
    };
}

function indexExtract(params: Record<string, unknown>): number | null {
    const index = params.index;
    if (typeof index === "number" && Number.isInteger(index) && index >= 0) {
        return index;
    }
    return null;
}

function todoAtIndex(state: StateModel, index: number): ExperimentsTodo | null {
    const value = getByPath(state, `/todos/${index}`);
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    if (
        typeof candidate.id !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.done !== "boolean" ||
        typeof candidate.createdAt !== "number"
    ) {
        return null;
    }

    return {
        id: candidate.id,
        title: candidate.title,
        done: candidate.done,
        createdAt: candidate.createdAt
    };
}
