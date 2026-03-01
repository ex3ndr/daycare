import type { AgentSummary } from "./engine-client";

const RESERVED_USER_SEGMENTS = new Set(["agent", "cron", "task", "subuser", "app"]);

export type AgentType =
  | { type: "connection"; connector: string; path: string }
  | { type: "cron"; id: string; path: string }
  | { type: "task"; id: string; path: string }
  | { type: "heartbeat"; path: string }
  | { type: "subagent"; index: number; parentPath: string; path: string }
  | { type: "app"; appId: string; path: string }
  | { type: "permanent"; name: string; path: string }
  | { type: "memory-agent"; parentPath: string; path: string }
  | { type: "memory-search"; index: number; parentPath: string; path: string }
  | { type: "subuser"; id: string; path: string }
  | { type: "system"; tag: string; path: string }
  | { type: "unknown"; path: string };

export function buildAgentType(agent: AgentSummary): AgentType {
  const path = (agent.path ?? "").trim();
  if (!path.startsWith("/")) {
    return { type: "unknown", path };
  }
  const segments = pathSegments(path);
  if (segments.length === 0) {
    return { type: "unknown", path };
  }

  if (segments[0] === "system") {
    const tag = segments[1] ?? "unknown";
    if (tag === "heartbeat") {
      return { type: "heartbeat", path };
    }
    return { type: "system", tag, path };
  }

  const memoryParent = suffixParentPathResolve(path, "memory");
  if (memoryParent) {
    return { type: "memory-agent", parentPath: memoryParent, path };
  }

  const searchInfo = suffixIndexResolve(path, "search");
  if (searchInfo) {
    return { type: "memory-search", index: searchInfo.index, parentPath: searchInfo.parentPath, path };
  }

  const subInfo = suffixIndexResolve(path, "sub");
  if (subInfo) {
    return { type: "subagent", index: subInfo.index, parentPath: subInfo.parentPath, path };
  }

  const userScopeSegment = segments[1] ?? "";
  if (userScopeSegment === "cron") {
    return { type: "cron", id: segments[2] ?? "", path };
  }
  if (userScopeSegment === "task") {
    return { type: "task", id: segments[2] ?? "", path };
  }
  if (userScopeSegment === "agent") {
    return { type: "permanent", name: segments[2] ?? "", path };
  }
  if (userScopeSegment === "app") {
    return { type: "app", appId: segments[2] ?? "", path };
  }
  if (userScopeSegment === "subuser") {
    return { type: "subuser", id: segments[2] ?? "", path };
  }
  if (segments.length >= 2 && !RESERVED_USER_SEGMENTS.has(userScopeSegment)) {
    return { type: "connection", connector: userScopeSegment, path };
  }

  return { type: "unknown", path };
}

export function formatAgentIdentity(agent: AgentSummary): string {
  const path = agent.path?.trim();
  if (path && path.length > 0) {
    return path;
  }
  return "(path unavailable)";
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
    case "unknown":
      return "Unknown";
    default:
      return "Agent";
  }
}

export function formatAgentTypeObject(agentType: AgentType): string {
  return JSON.stringify(agentType);
}

function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function suffixParentPathResolve(path: string, suffix: "memory"): string | null {
  const segments = pathSegments(path);
  if (segments.length < 2 || segments[segments.length - 1] !== suffix) {
    return null;
  }
  return `/${segments.slice(0, -1).join("/")}`;
}

function suffixIndexResolve(path: string, suffix: "search" | "sub"): { index: number; parentPath: string } | null {
  const segments = pathSegments(path);
  if (segments.length < 3 || segments[segments.length - 2] !== suffix) {
    return null;
  }
  const raw = segments[segments.length - 1] ?? "";
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return {
    index: Number(raw),
    parentPath: `/${segments.slice(0, -2).join("/")}`
  };
}
