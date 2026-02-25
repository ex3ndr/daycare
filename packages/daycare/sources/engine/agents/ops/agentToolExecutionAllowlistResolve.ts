import type { AgentDescriptor } from "@/types";

/**
 * Resolves per-agent execution allowlists used by ToolResolver.execute guards.
 * Expects: descriptor is validated.
 */
export function agentToolExecutionAllowlistResolve(descriptor: AgentDescriptor): ReadonlySet<string> | undefined {
    if (descriptor.type === "memory-search") {
        return new Set<string>(["memory_node_read", "send_agent_message"]);
    }

    if (descriptor.type !== "memory-agent") {
        return undefined;
    }

    return new Set<string>(["memory_node_read", "memory_node_write"]);
}
