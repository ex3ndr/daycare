import type { ModelRoleKey } from "../../../settings.js";
import { agentPathKind } from "./agentPathParse.js";
import type { AgentPath } from "./agentPathTypes.js";

/**
 * Maps an agent path to a model role key.
 * Returns null for path kinds without dedicated role selection.
 */
export function agentPathRoleResolve(pathValue: AgentPath): ModelRoleKey | null {
    const kind = agentPathKind(pathValue);
    if (kind === "connector" || kind === "agent" || kind === "subuser") {
        return "user";
    }
    if (kind === "sub") {
        return "subagent";
    }
    if (kind === "memory") {
        return "memory";
    }
    if (kind === "search") {
        return "memorySearch";
    }
    if (kind === "task") {
        return "task";
    }
    return null;
}
