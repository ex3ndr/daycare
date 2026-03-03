import { getByPath, type StateModel, type StateStore } from "@json-render/core";
import { createId } from "@paralleldrive/cuid2";
import { experimentsSqlTemplateRender } from "./experimentsSqlTemplateRender";
import type { ExperimentsTodoDb } from "./experimentsTodoDb";
import { experimentsTodoDefinition } from "./experimentsTodoDefinition";
import type { ExperimentsTodo } from "./experimentsTodoTypes";

type ExperimentsTodoHandlersBuildInput = {
    dbResolve: () => ExperimentsTodoDb | null;
    stateStore: StateStore;
};

type JsonActionHandler = (params: Record<string, unknown>) => Promise<void>;

/**
 * Initializes the experiments SQL model and syncs initial query snapshots into state.
 * Expects: database adapter supports `init`, `exec`, and `query`.
 */
export async function experimentsTodoInitialize(input: ExperimentsTodoHandlersBuildInput): Promise<void> {
    const db = input.dbResolve();
    if (!db) {
        input.stateStore.set("/error", "Todo database is not ready yet.");
        return;
    }

    input.stateStore.update({
        "/loading": true,
        "/ready": false,
        "/error": null
    });

    try {
        await db.init();
        await sqlBootstrapRun(db, input.stateStore);
        await queriesRefresh(db, input.stateStore);

        input.stateStore.update({
            "/loading": false,
            "/ready": true,
            "/error": null
        });
    } catch (error) {
        input.stateStore.update({
            "/loading": false,
            "/ready": false,
            "/error": error instanceof Error ? error.message : "Failed to initialize experiments."
        });
    }
}

/**
 * Builds JSON-render handlers that execute SQL templates and refresh query snapshots.
 * Expects: action params are already data-bound by JSON-render, with optional nested `$state` lookups.
 */
export function experimentsTodoHandlersBuild(
    input: ExperimentsTodoHandlersBuildInput
): Record<string, JsonActionHandler> {
    const definitions = new Map(experimentsTodoDefinition.actions.map((action) => [action.id, action]));

    async function runAction(actionId: string, params: Record<string, unknown>): Promise<void> {
        const db = input.dbResolve();
        if (!db) {
            input.stateStore.set("/error", "Todo database is not ready yet.");
            return;
        }

        const definition = definitions.get(actionId);
        if (!definition) {
            input.stateStore.set("/error", `Unknown action: ${actionId}`);
            return;
        }

        try {
            const state = input.stateStore.getSnapshot();
            const resolvedParams = paramsResolve(state, params);
            const sql = experimentsSqlTemplateRender(definition.sql, {
                state,
                params: resolvedParams,
                runtime: {
                    now: Date.now(),
                    generatedId: createId()
                }
            });

            await db.exec(sql);

            if (actionId === "todoCreate") {
                input.stateStore.set("/draft/title", "");
            }

            await queriesRefresh(db, input.stateStore, definition.refreshQueries);

            input.stateStore.update({
                "/ready": true,
                "/error": null
            });
        } catch (error) {
            input.stateStore.update({
                "/error": error instanceof Error ? error.message : "SQL action failed."
            });
        }
    }

    return Object.fromEntries(
        experimentsTodoDefinition.actions.map((action) => [
            action.id,
            async (params: Record<string, unknown>) => runAction(action.id, params)
        ])
    );
}

async function sqlBootstrapRun(db: ExperimentsTodoDb, stateStore: StateStore): Promise<void> {
    for (const sqlTemplate of experimentsTodoDefinition.bootstrapSql) {
        const sql = experimentsSqlTemplateRender(sqlTemplate, {
            state: stateStore.getSnapshot(),
            params: {},
            runtime: {
                now: Date.now(),
                generatedId: createId()
            }
        });
        await db.exec(sql);
    }
}

async function queriesRefresh(db: ExperimentsTodoDb, stateStore: StateStore, queryIds?: string[]): Promise<void> {
    const selected = queryIds
        ? experimentsTodoDefinition.queries.filter((query) => queryIds.includes(query.id))
        : experimentsTodoDefinition.queries;

    const updates: Record<string, unknown> = {};
    for (const query of selected) {
        const sql = experimentsSqlTemplateRender(query.sql, {
            state: stateStore.getSnapshot(),
            params: {},
            runtime: {
                now: Date.now(),
                generatedId: createId()
            }
        });
        const rows = await db.query<Record<string, unknown>>(sql);
        updates[query.statePath] =
            query.mode === "row" ? rowNormalize(query.id, rows[0] ?? null) : rowsNormalize(query.id, rows);
    }

    if (Object.keys(updates).length > 0) {
        const total = queryIds
            ? Number(stateStore.get("/stats/total") ?? 0)
            : Number((updates["/stats"] as Record<string, unknown>)?.total ?? 0);
        if (total === 0) {
            updates["/draft/title"] = "";
        }
        stateStore.update(pointerUpdatesFlatten(updates));
    }
}

function paramsResolve(state: StateModel, params: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
        resolved[key] = paramValueResolve(state, value);
    }
    return resolved;
}

function paramValueResolve(state: StateModel, value: unknown): unknown {
    if (!value || typeof value !== "object") {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => paramValueResolve(state, item));
    }

    const record = value as Record<string, unknown>;
    const statePath = typeof record.$state === "string" ? record.$state : null;
    if (statePath) {
        return getByPath(state, statePath);
    }

    const nested: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
        nested[key] = paramValueResolve(state, item);
    }
    return nested;
}

function rowsNormalize(queryId: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
    if (queryId !== "todos") {
        return rows;
    }

    return rows.map((row) => todoFromRow(row));
}

function rowNormalize(queryId: string, row: Record<string, unknown> | null): Record<string, unknown> | null {
    if (queryId !== "stats") {
        return row;
    }

    if (!row) {
        return { total: 0, completed: 0, open: 0 };
    }

    return {
        total: numberCoerce(row.total),
        completed: numberCoerce(row.completed),
        open: numberCoerce(row.open)
    };
}

function pointerUpdatesFlatten(updates: Record<string, unknown>): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};
    for (const [statePath, value] of Object.entries(updates)) {
        if (statePath !== "/stats" || !value || typeof value !== "object") {
            flattened[statePath] = value;
            continue;
        }

        const stats = value as Record<string, unknown>;
        flattened["/stats/total"] = numberCoerce(stats.total);
        flattened["/stats/completed"] = numberCoerce(stats.completed);
        flattened["/stats/open"] = numberCoerce(stats.open);
    }
    return flattened;
}

function todoFromRow(row: Record<string, unknown>): ExperimentsTodo {
    return {
        id: String(row.id ?? ""),
        title: String(row.title ?? ""),
        done: row.done === true || row.done === "t" || row.done === "true" || row.done === 1,
        createdAt: numberCoerce(row.createdAt)
    };
}

function numberCoerce(value: unknown): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
