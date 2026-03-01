import type { AgentPath, AgentPathKind } from "./agentPathTypes.js";
import { agentPath } from "./agentPathTypes.js";

const RESERVED_ROOT_SEGMENTS = new Set(["agent", "cron", "task", "subuser"]);

/**
 * Resolves an agent path category from its segment pattern.
 * Expects: pathValue is a validated AgentPath.
 */
export function agentPathKind(pathValue: AgentPath): AgentPathKind {
    const rawPath = String(pathValue);
    if (rawPath.endsWith("/memory")) {
        return "memory";
    }
    if (/\/search\/\d+$/.test(rawPath)) {
        return "search";
    }
    if (/\/sub\/\d+$/.test(rawPath)) {
        return "sub";
    }
    if (rawPath.startsWith("/system/")) {
        return "system";
    }

    const segments = pathSegments(pathValue);
    if (segments.length < 2) {
        throw new Error(`Unknown path pattern: ${pathValue}`);
    }

    const second = segments[1] ?? "";
    if (second === "agent") {
        return "agent";
    }
    if (second === "cron") {
        return "cron";
    }
    if (second === "task") {
        return "task";
    }
    if (second === "subuser") {
        return "subuser";
    }
    if (!RESERVED_ROOT_SEGMENTS.has(second)) {
        return "connector";
    }
    throw new Error(`Unknown path pattern: ${pathValue}`);
}

/**
 * Returns the parent agent path for nested paths, otherwise null.
 * Expects: pathValue is a validated AgentPath.
 */
export function agentPathParent(pathValue: AgentPath): AgentPath | null {
    const segments = pathSegments(pathValue);
    if (segments.length <= 2) {
        return null;
    }
    const parent = `/${segments.slice(0, -1).join("/")}`;
    return agentPath(parent);
}

/**
 * Extracts the owning user id from a path.
 * Returns null for system paths.
 */
export function agentPathUserId(pathValue: AgentPath): string | null {
    if (agentPathKind(pathValue) === "system") {
        return null;
    }
    const segments = pathSegments(pathValue);
    const userId = segments[0]?.trim() ?? "";
    return userId.length > 0 ? userId : null;
}

/**
 * Extracts connector name when the path is a connector root.
 * Returns null for non-connector paths.
 */
export function agentPathConnectorName(pathValue: AgentPath): string | null {
    if (agentPathKind(pathValue) !== "connector") {
        return null;
    }
    const segments = pathSegments(pathValue);
    const connector = segments[1]?.trim() ?? "";
    return connector.length > 0 ? connector : null;
}

function pathSegments(pathValue: AgentPath): string[] {
    return String(pathValue)
        .split("/")
        .filter((segment) => segment.length > 0);
}
