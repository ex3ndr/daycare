import type { AgentKind } from "@/types";

/**
 * Resolves per-agent execution allowlists used by ToolResolver.execute guards.
 * Expects: kind is normalized from agent config.
 */
export function agentToolExecutionAllowlistResolve(kind: AgentKind): ReadonlySet<string> | undefined {
    if (kind === "search") {
        return new Set<string>(["document_read", "send_agent_message"]);
    }

    if (kind !== "memory" && kind !== "compactor") {
        return undefined;
    }

    return new Set<string>([
        "now",
        "document_read",
        "document_tree",
        "document_append",
        "document_patch",
        "document_write"
    ]);
}
