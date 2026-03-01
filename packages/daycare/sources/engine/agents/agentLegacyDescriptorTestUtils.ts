import type { AgentCreationConfig } from "@/types";
import {
    agentPathAgent,
    agentPathConnector,
    agentPathCron,
    agentPathMemory,
    agentPathSearch,
    agentPathSub,
    agentPathSystem,
    agentPathTask
} from "./ops/agentPathBuild.js";
import { type AgentPath, agentPath } from "./ops/agentPathTypes.js";

export type AgentLegacyDescriptor =
    | { type: "user"; connector: string; userId: string; channelId: string }
    | { type: "cron"; id: string; name?: string }
    | { type: "task"; id: string }
    | { type: "system"; tag: string }
    | {
          type: "subagent";
          id: string;
          parentAgentId: string;
          name: string;
      }
    | {
          type: "permanent";
          id: string;
          name: string;
          username?: string;
          description: string;
          systemPrompt: string;
          workspaceDir?: string;
      }
    | { type: "memory-agent"; id: string }
    | {
          type: "memory-search";
          id: string;
          parentAgentId: string;
          name: string;
      }
    | {
          type: "swarm";
          id: string;
      };

export type AgentPathFromLegacyDescriptorOptions = {
    userId: string;
    parentPath?: AgentPath | null;
    subIndex?: number | null;
    searchIndex?: number | null;
};

/**
 * Converts legacy descriptor fixtures into canonical path identity for tests.
 * Expects: options.userId is the internal user scope for the descriptor.
 */
export function agentPathFromLegacyDescriptor(
    descriptor: AgentLegacyDescriptor,
    options: AgentPathFromLegacyDescriptorOptions
): AgentPath {
    if (descriptor.type === "system") {
        return agentPathSystem(descriptor.tag);
    }

    const userId = options.userId.trim();
    if (!userId) {
        throw new Error("userId is required to derive AgentPath from descriptor.");
    }

    if (descriptor.type === "user") {
        return agentPathConnector(userId, descriptor.connector);
    }
    if (descriptor.type === "cron") {
        return agentPathCron(userId, descriptor.id);
    }
    if (descriptor.type === "task") {
        return agentPathTask(userId, descriptor.id);
    }
    if (descriptor.type === "permanent") {
        return agentPathAgent(userId, descriptor.name);
    }
    if (descriptor.type === "subagent") {
        const parentPath = options.parentPath;
        const subIndex = options.subIndex;
        if (parentPath && typeof subIndex === "number") {
            return agentPathSub(parentPath, subIndex);
        }
        return agentPath(`/${userId}/agent/${descriptor.parentAgentId}/sub/${descriptor.id}`);
    }
    if (descriptor.type === "memory-agent") {
        if (options.parentPath) {
            return agentPathMemory(options.parentPath);
        }
        return agentPath(`/${userId}/memory/${descriptor.id}`);
    }
    if (descriptor.type === "memory-search") {
        const parentPath = options.parentPath;
        const searchIndex = options.searchIndex;
        if (parentPath && typeof searchIndex === "number") {
            return agentPathSearch(parentPath, searchIndex);
        }
        return agentPath(`/${userId}/agent/${descriptor.parentAgentId}/search/${descriptor.id}`);
    }
    if (descriptor.type === "swarm") {
        return agentPathAgent(userId, "swarm");
    }

    return descriptorTypeUnreachable(descriptor);
}

/**
 * Builds creation config fixtures from legacy descriptor test inputs.
 * Expects: descriptor mirrors the historical agent test shape.
 */
export function agentCreationConfigFromLegacyDescriptor(descriptor: AgentLegacyDescriptor): AgentCreationConfig {
    if (descriptor.type === "user") {
        return {
            kind: "connector",
            foreground: true,
            connectorName: descriptor.connector
        };
    }
    if (descriptor.type === "swarm") {
        return {
            kind: "swarm",
            foreground: true,
            name: "swarm"
        };
    }
    if (descriptor.type === "cron") {
        return {
            kind: "cron",
            name: descriptor.name ?? null
        };
    }
    if (descriptor.type === "task") {
        return {
            kind: "task",
            name: null
        };
    }
    if (descriptor.type === "system") {
        return {
            kind: "system",
            name: descriptor.tag
        };
    }
    if (descriptor.type === "subagent") {
        return {
            kind: "sub",
            parentAgentId: descriptor.parentAgentId,
            name: descriptor.name
        };
    }
    if (descriptor.type === "permanent") {
        return {
            kind: "agent",
            foreground: false,
            name: descriptor.name,
            description: descriptor.description,
            systemPrompt: descriptor.systemPrompt,
            workspaceDir: descriptor.workspaceDir ?? null
        };
    }
    if (descriptor.type === "memory-agent") {
        return {
            kind: "memory",
            name: "memory-agent"
        };
    }
    if (descriptor.type === "memory-search") {
        return {
            kind: "search",
            parentAgentId: descriptor.parentAgentId,
            name: descriptor.name
        };
    }
    return descriptorTypeUnreachable(descriptor);
}

function descriptorTypeUnreachable(_value: never): never {
    throw new Error("Unhandled descriptor type");
}
