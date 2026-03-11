/**
 * Allowlist of tools that mini app fragments can invoke via the server-side bridge.
 * Only read-only, safe tools are allowed — no writes, no agent spawning, no destructive operations.
 */
export const FRAGMENT_TOOL_ALLOWLIST = new Set<string>([
    // File system (read-only)
    "read",
    "read_json",

    // Shell execution (scoped to workspace, read-only intent)
    "exec",

    // Database queries (read-only)
    "psql_query",
    "psql_db_list",

    // Document reading
    "document_read",

    // Todo reading
    "todo_list",

    // Web search
    "exa_search",

    // JSON utilities
    "json_parse",
    "json_stringify",

    // Observations and signals (read-only)
    "observation_query",
    "signal_events_csv"
]);

/**
 * Returns true if the tool name is allowed for fragment execution.
 */
export function fragmentToolAllowed(toolName: string): boolean {
    return FRAGMENT_TOOL_ALLOWLIST.has(toolName);
}

/**
 * Returns a human-readable list of allowed tools.
 */
export function fragmentToolAllowlistDescribe(): string {
    return Array.from(FRAGMENT_TOOL_ALLOWLIST).sort().join(", ");
}
