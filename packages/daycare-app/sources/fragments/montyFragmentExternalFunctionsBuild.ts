import type { StateStore } from "@json-render/react-native";
import { databaseQuery } from "@/modules/databases/databaseQuery";
import { montyFragmentStateApply } from "./montyFragmentStateApply";

type MontyExternalFunction = (...args: unknown[]) => unknown | Promise<unknown>;

type MontyFragmentExternalFunctionsBuildOptions = {
    store: StateStore;
    baseUrl: string | null;
    token: string | null;
    workspaceNametag: string | null;
};

/**
 * Builds external functions exposed to fragment Python code.
 * Expects: store is the fragment state store; auth values may be null for offline fragments.
 */
export function montyFragmentExternalFunctionsBuild(
    options: MontyFragmentExternalFunctionsBuildOptions
): Record<string, MontyExternalFunction> {
    return {
        get_state: () => fragmentStateRead(options.store),
        _apply_state: (changes) => montyFragmentStateApply(options.store, changes),
        query_database: async (dbId, sql, params) => {
            if (!options.baseUrl || !options.token) {
                throw new Error("query_database() requires an authenticated app session.");
            }
            if (typeof dbId !== "string" || !dbId.trim()) {
                throw new Error("query_database() requires a database id.");
            }
            if (typeof sql !== "string" || !sql.trim()) {
                throw new Error("query_database() requires a SQL string.");
            }

            return databaseQuery(
                options.baseUrl,
                options.token,
                options.workspaceNametag,
                dbId,
                sql,
                Array.isArray(params) ? params : params === undefined ? [] : [params]
            );
        }
    };
}

function fragmentStateRead(store: StateStore): Record<string, unknown> {
    const snapshot = store.getSnapshot();
    return isRecord(snapshot) ? snapshot : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
