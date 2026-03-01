import type { AgentConfig } from "./agentConfigTypes.js";
import { agentPathKind } from "./agentPathParse.js";
import type { AgentPath } from "./agentPathTypes.js";

/**
 * Builds a short display label from path identity and optional config metadata.
 * Expects: pathValue is a validated AgentPath.
 */
export function agentPathLabel(pathValue: AgentPath, config?: AgentConfig | null): string {
    const kind = agentPathKind(pathValue);
    const fallback = pathTail(pathValue);

    if (kind === "system") {
        return fallback;
    }
    if (kind === "task") {
        return `task ${fallback}`;
    }
    if (kind === "cron") {
        return config?.name?.trim() || "cron task";
    }
    if (kind === "memory") {
        return "memory-agent";
    }
    if (kind === "search") {
        return config?.name?.trim() || "memory-search";
    }
    if (config?.name?.trim()) {
        if (config.username?.trim()) {
            return `${config.name.trim()} (@${config.username.trim()})`;
        }
        return config.name.trim();
    }
    if (kind === "connector") {
        return "user";
    }
    if (kind === "sub") {
        return "subagent";
    }
    return fallback;
}

function pathTail(pathValue: AgentPath): string {
    const segments = String(pathValue)
        .split("/")
        .filter((segment) => segment.length > 0);
    return segments[segments.length - 1] ?? "agent";
}
