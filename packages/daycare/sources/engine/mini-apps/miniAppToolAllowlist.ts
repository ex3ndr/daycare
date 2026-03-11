/**
 * Allowlist of tools that mini apps can execute via the Python bridge.
 * Only read-only and query tools are permitted.
 */
export const MINI_APP_TOOL_ALLOWLIST: ReadonlySet<string> = new Set([
    // File reading
    "read",
    "read_json",

    // Shell execution (sandboxed)
    "exec",

    // PSQL (read-only queries)
    "psql_query",
    "psql_db_list",

    // Document reading
    "document_read",

    // Todo listing
    "todo_list",

    // Web search
    "exa_search",

    // JSON utilities
    "json_parse",
    "json_stringify",

    // Observation/signal queries
    "observation_query",
    "signal_events_csv"
]);
