import type { AgentKind } from "@/types";

/**
 * Resolves per-agent execution allowlists used by ToolResolver.execute guards.
 * Expects: kind is normalized from agent config.
 */
export function agentToolExecutionAllowlistResolve(kind: AgentKind): ReadonlySet<string> | undefined {
    if (kind === "search") {
        return new Set<string>(["vault_read", "send_agent_message"]);
    }

    if (kind !== "memory" && kind !== "compactor") {
        return undefined;
    }

    return new Set<string>(["now", "vault_read", "vault_tree", "vault_append", "vault_patch", "vault_write"]);
}
