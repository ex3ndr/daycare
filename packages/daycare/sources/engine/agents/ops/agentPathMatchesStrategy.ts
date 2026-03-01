import type { AgentFetchStrategy } from "./agentDescriptorTypes.js";
import { agentPathKind } from "./agentPathParse.js";
import type { AgentPath } from "./agentPathTypes.js";

/**
 * Checks whether a path matches a fetch strategy.
 * Expects: pathValue is a validated AgentPath.
 */
export function agentPathMatchesStrategy(pathValue: AgentPath, strategy: AgentFetchStrategy): boolean {
    if (strategy !== "most-recent-foreground") {
        return false;
    }
    const kind = agentPathKind(pathValue);
    return kind === "connector" || kind === "agent" || kind === "subuser";
}
