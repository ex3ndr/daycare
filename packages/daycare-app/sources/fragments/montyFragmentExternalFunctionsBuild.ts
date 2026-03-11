import { databaseQuery } from "@/modules/databases/databaseQuery";
import { fragmentCallTool } from "@/modules/fragments/fragmentCallTool";

type MontyExternalFunction = (...args: unknown[]) => unknown | Promise<unknown>;

type MontyFragmentExternalFunctionsBuildOptions = {
    baseUrl: string | null;
    token: string | null;
    workspaceId: string | null;
    fragmentId?: string | null;
};

/**
 * Builds external functions exposed to fragment Python code.
 * Expects: auth values may be null for offline fragments.
 */
export function montyFragmentExternalFunctionsBuild(
    options: MontyFragmentExternalFunctionsBuildOptions
): Record<string, MontyExternalFunction> {
    return {
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
                options.workspaceId,
                dbId,
                sql,
                Array.isArray(params) ? params : params === undefined ? [] : [params]
            );
        },

        /**
         * Call a server-side tool via the fragment tool bridge.
         * Only read-only tools are allowed (psql_query, todo_list, document_read, etc.)
         */
        call: async (toolName, args) => {
            if (!options.baseUrl || !options.token) {
                throw new Error("call() requires an authenticated app session.");
            }
            if (!options.fragmentId) {
                throw new Error("call() requires a fragment context.");
            }
            if (typeof toolName !== "string" || !toolName.trim()) {
                throw new Error("call() requires a tool name.");
            }

            const toolArgs = typeof args === "object" && args !== null && !Array.isArray(args)
                ? (args as Record<string, unknown>)
                : {};

            return fragmentCallTool(
                options.baseUrl,
                options.token,
                options.workspaceId,
                options.fragmentId,
                toolName,
                toolArgs
            );
        }
    };
}
