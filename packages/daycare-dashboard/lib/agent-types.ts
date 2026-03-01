import type { AgentSummary } from "./engine-client";

export type AgentType =
  | { type: "connection"; connector: string; userId: string; channelId: string }
  | { type: "cron"; id: string }
  | { type: "task"; id: string }
  | { type: "heartbeat" }
  | { type: "subagent"; id: string; parentAgentId: string; name: string }
  | { type: "app"; id: string; parentAgentId: string; name: string; appId: string }
  | { type: "permanent"; id: string; name: string }
  | { type: "memory-agent"; id: string }
  | { type: "memory-search"; id: string; parentAgentId: string; name: string }
  | { type: "subuser"; id: string; name: string }
  | { type: "system"; tag: string };

export function buildAgentType(agent: AgentSummary): AgentType {
  const descriptor = agent.descriptor;
  switch (descriptor.type) {
    case "user":
      return {
        type: "connection",
        connector: descriptor.connector,
        userId: descriptor.userId,
        channelId: descriptor.channelId
      };
    case "cron":
      return { type: "cron", id: descriptor.id };
    case "task":
      return { type: "task", id: descriptor.id };
    case "system":
      if (descriptor.tag === "heartbeat") {
        return { type: "heartbeat" };
      }
      return { type: "system", tag: descriptor.tag };
    case "subagent":
      return {
        type: "subagent",
        id: descriptor.id,
        parentAgentId: descriptor.parentAgentId,
        name: descriptor.name
      };
    case "app":
      return {
        type: "app",
        id: descriptor.id,
        parentAgentId: descriptor.parentAgentId,
        name: descriptor.name,
        appId: descriptor.appId
      };
    case "permanent":
      return {
        type: "permanent",
        id: descriptor.id,
        name: descriptor.name
      };
    case "memory-agent":
      return { type: "memory-agent", id: descriptor.id };
    case "memory-search":
      return {
        type: "memory-search",
        id: descriptor.id,
        parentAgentId: descriptor.parentAgentId,
        name: descriptor.name
      };
    case "subuser":
      return {
        type: "subuser",
        id: descriptor.id,
        name: descriptor.name
      };
    default:
      return { type: "system", tag: "unknown" };
  }
}

export function formatAgentTypeLabel(agentType: AgentType): string {
  switch (agentType.type) {
    case "connection":
      return "Connection";
    case "cron":
      return "Cron";
    case "task":
      return "Task";
    case "heartbeat":
      return "Heartbeat";
    case "subagent":
      return "Subagent";
    case "app":
      return "App";
    case "permanent":
      return "Permanent";
    case "memory-agent":
      return "Memory";
    case "memory-search":
      return "Memory Search";
    case "subuser":
      return "Subuser";
    case "system":
      return "System";
    default:
      return "Agent";
  }
}

export function formatAgentTypeObject(agentType: AgentType): string {
  return JSON.stringify(agentType);
}
