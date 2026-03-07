import { databaseQuery } from "@/modules/databases/databaseQuery";

type MontyExternalFunction = (...args: unknown[]) => unknown | Promise<unknown>;

type MontyFragmentExternalFunctionsBuildOptions = {
    baseUrl: string | null;
    token: string | null;
    workspaceId: string | null;
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
        }
    };
}
