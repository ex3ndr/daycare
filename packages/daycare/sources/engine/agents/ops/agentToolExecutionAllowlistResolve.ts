import type { AgentDescriptor } from "@/types";
import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";

type AgentToolExecutionAllowlistResolveOptions = {
    rlmEnabled: boolean;
};

/**
 * Resolves per-agent execution allowlists used by ToolResolver.execute guards.
 * Expects: descriptor is validated; rlmEnabled reflects runtime feature configuration.
 */
export function agentToolExecutionAllowlistResolve(
    descriptor: AgentDescriptor,
    options: AgentToolExecutionAllowlistResolveOptions
): ReadonlySet<string> | undefined {
    if (descriptor.type !== "memory-agent") {
        return undefined;
    }

    const allowedToolNames = new Set<string>(["memory_node_read", "memory_node_write"]);
    if (options.rlmEnabled) {
        allowedToolNames.add(RLM_TOOL_NAME);
        allowedToolNames.add(SKIP_TOOL_NAME);
    }
    return allowedToolNames;
}
