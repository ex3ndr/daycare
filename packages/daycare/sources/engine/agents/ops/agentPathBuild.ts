import { type AgentPath, agentPath } from "./agentPathTypes.js";

/**
 * Builds a connector path for a user-scoped connector endpoint.
 * Expects: userId and connector are non-empty path segments.
 */
export function agentPathConnector(userId: string, connector: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/${segmentRequire(connector, "connector")}`);
}

/**
 * Builds a permanent/named agent path under a user.
 * Expects: userId and name are non-empty path segments.
 */
export function agentPathAgent(userId: string, name: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/agent/${segmentRequire(name, "name")}`);
}

/**
 * Builds an app agent path under a user.
 * Expects: userId and id are non-empty path segments.
 */
export function agentPathApp(userId: string, id: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/app/${segmentRequire(id, "id")}`);
}

/**
 * Builds the singleton supervisor path under a user.
 * Expects: userId is a non-empty path segment.
 */
export function agentPathSupervisor(userId: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/supervisor`);
}

/**
 * Builds a cron agent path under a user.
 * Expects: userId and id are non-empty path segments.
 */
export function agentPathCron(userId: string, id: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/cron/${segmentRequire(id, "id")}`);
}

/**
 * Builds a task agent path under a user.
 * Expects: userId and id are non-empty path segments.
 */
export function agentPathTask(userId: string, id: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/task/${segmentRequire(id, "id")}`);
}

/**
 * Builds a subuser gateway path.
 * Expects: userId and id are non-empty path segments.
 */
export function agentPathSubuser(userId: string, id: string): AgentPath {
    return agentPath(`/${segmentRequire(userId, "userId")}/subuser/${segmentRequire(id, "id")}`);
}

/**
 * Builds a direct messaging path between two entities.
 * Expects: ownerId and targetId are non-empty path segments.
 */
export function agentPathDirect(ownerId: string, targetId: string): AgentPath {
    return agentPath(`/${segmentRequire(ownerId, "ownerId")}/direct/${segmentRequire(targetId, "targetId")}`);
}

/**
 * Builds a child subagent path.
 * Expects: parentPath is valid and index is a non-negative integer.
 */
export function agentPathSub(parentPath: AgentPath, index: number): AgentPath {
    return agentPath(`${parentPath}/sub/${indexRequire(index, "index")}`);
}

/**
 * Builds a memory worker path from a parent path.
 * Expects: agentPathValue is valid.
 */
export function agentPathMemory(agentPathValue: AgentPath): AgentPath {
    return agentPath(`${agentPathValue}/memory`);
}

/**
 * Builds a memory-search child path.
 * Expects: agentPathValue is valid and index is a non-negative integer.
 */
export function agentPathSearch(agentPathValue: AgentPath, index: number): AgentPath {
    return agentPath(`${agentPathValue}/search/${indexRequire(index, "index")}`);
}

function segmentRequire(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${label} is required`);
    }
    if (normalized.includes("/")) {
        throw new Error(`${label} must not include '/'`);
    }
    return normalized;
}

function indexRequire(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return value;
}
