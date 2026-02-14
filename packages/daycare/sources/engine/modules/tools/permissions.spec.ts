import { describe, expect, it, vi } from "vitest";

import type {
  AgentDescriptor,
  PermissionDecision,
  PermissionRequest,
  SessionPermissions,
  ToolExecutionContext
} from "@/types";
import { PermissionRequestRegistry } from "./permissionRequestRegistry.js";
import { buildPermissionRequestTool } from "./permissions.js";

const toolCall = { id: "tool-1", name: "request_permission" };

describe("buildPermissionRequestTool", () => {
  it("waits for approval and returns a granted result", async () => {
    const registry = new PermissionRequestRegistry();
    const grantPermission = vi.fn(async () => undefined);
    const requestPermission = vi.fn(
      async (
        _targetId: string,
        _request: PermissionRequest,
        _context: unknown,
        _descriptor: unknown
      ) => undefined
    );

    const context = contextBuild({
      registry,
      connector: { requestPermission },
      agentSystem: { grantPermission }
    });

    const pending = buildPermissionRequestTool().execute(
      { permission: "@network", reason: "Need web access" },
      context,
      toolCall
    );

    await Promise.resolve();
    const request = requestPermission.mock.calls[0]?.[1] as PermissionRequest | undefined;
    if (!request) {
      throw new Error("Expected permission request payload");
    }

    await registryResolveWhenReady(
      registry,
      decisionBuild({
        token: request.token,
        agentId: request.agentId,
        approved: true,
        permission: request.permission,
        access: request.access
      })
    );

    const result = await pending;
    expect(grantPermission).toHaveBeenCalledWith(
      { agentId: "agent-1" },
      { kind: "network" },
      expect.objectContaining({ source: "telegram" })
    );
    expect(result.toolMessage.isError).toBe(false);
    expect(contentText(result.toolMessage.content)).toBe(
      "Permission granted for network access."
    );
  });

  it("waits for denial and returns a denied result", async () => {
    const registry = new PermissionRequestRegistry();
    const grantPermission = vi.fn(async () => undefined);
    const requestPermission = vi.fn(
      async (
        _targetId: string,
        _request: PermissionRequest,
        _context: unknown,
        _descriptor: unknown
      ) => undefined
    );

    const context = contextBuild({
      registry,
      connector: { requestPermission },
      agentSystem: { grantPermission }
    });

    const pending = buildPermissionRequestTool().execute(
      { permission: "@network", reason: "Need web access" },
      context,
      toolCall
    );

    await Promise.resolve();
    const request = requestPermission.mock.calls[0]?.[1] as PermissionRequest | undefined;
    if (!request) {
      throw new Error("Expected permission request payload");
    }

    await registryResolveWhenReady(
      registry,
      decisionBuild({
        token: request.token,
        agentId: request.agentId,
        approved: false,
        permission: request.permission,
        access: request.access
      })
    );

    const result = await pending;
    expect(grantPermission).not.toHaveBeenCalled();
    expect(result.toolMessage.isError).toBe(false);
    expect(contentText(result.toolMessage.content)).toBe(
      "Permission denied for network access."
    );
  });

  it("returns an error result when the permission request times out", async () => {
    vi.useFakeTimers();
    try {
      const registry = new PermissionRequestRegistry();
      const grantPermission = vi.fn(async () => undefined);
      const requestPermission = vi.fn(
        async (
          _targetId: string,
          _request: PermissionRequest,
          _context: unknown,
          _descriptor: unknown
        ) => undefined
      );

      const context = contextBuild({
        registry,
        connector: { requestPermission },
        agentSystem: { grantPermission }
      });

      const pending = buildPermissionRequestTool().execute(
        {
          permission: "@network",
          reason: "Need web access",
          timeout_minutes: 1
        },
        context,
        toolCall
      );

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);

      const result = await pending;
      expect(grantPermission).not.toHaveBeenCalled();
      expect(result.toolMessage.isError).toBe(true);
      expect(contentText(result.toolMessage.content)).toBe(
        "Permission request timed out after 1 minute."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("notifies foreground agent when background agent requests permission", async () => {
    const registry = new PermissionRequestRegistry();
    const post = vi.fn(async () => undefined);
    const requestPermission = vi.fn(
      async (
        _targetId: string,
        _request: PermissionRequest,
        _context: unknown,
        _descriptor: unknown
      ) => undefined
    );

    const context = contextBuild({
      descriptor: {
        type: "permanent",
        id: "agent-1",
        name: "worker",
        description: "background worker",
        systemPrompt: "run tasks"
      },
      registry,
      connector: { requestPermission },
      agentSystem: {
        post,
        agentFor: () => "foreground-1",
        getAgentDescriptor: (agentId: string) => {
          if (agentId === "foreground-1") {
            return {
              type: "user",
              connector: "telegram",
              userId: "u1",
              channelId: "c1"
            };
          }
          return null;
        }
      }
    });

    const pending = buildPermissionRequestTool().execute(
      { permission: "@network", reason: "Need web access" },
      context,
      toolCall
    );

    await Promise.resolve();
    const request = requestPermission.mock.calls[0]?.[1] as PermissionRequest | undefined;
    if (!request) {
      throw new Error("Expected permission request payload");
    }

    await registryResolveWhenReady(
      registry,
      decisionBuild({
        token: request.token,
        agentId: request.agentId,
        approved: false,
        permission: request.permission,
        access: request.access
      })
    );

    await pending;

    expect(post).toHaveBeenCalledWith(
      { agentId: "foreground-1" },
      {
        type: "system_message",
        text: expect.stringContaining("Permission request from background agent \"worker\""),
        origin: "agent-1",
        silent: true
      }
    );
  });
});

function contextBuild(options: {
  descriptor?: AgentDescriptor;
  registry: PermissionRequestRegistry;
  connector?: {
    requestPermission?: (
      targetId: string,
      request: PermissionRequest,
      context: unknown,
      descriptor: unknown
    ) => Promise<void>;
  };
  agentSystem?: {
    grantPermission?: (...args: unknown[]) => Promise<void>;
    post?: (...args: unknown[]) => Promise<void>;
    agentFor?: (strategy: "most-recent-foreground" | "heartbeat") => string | null;
    getAgentDescriptor?: (agentId: string) => AgentDescriptor | null;
  };
}): ToolExecutionContext {
  const descriptor: AgentDescriptor =
    options.descriptor ?? {
      type: "user",
      connector: "telegram",
      userId: "u1",
      channelId: "c1"
    };

  const connector = {
    requestPermission: options.connector?.requestPermission,
    sendMessage: vi.fn(async () => undefined)
  };

  return {
    connectorRegistry: {
      get: vi.fn(() => connector)
    } as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: permissionsBuild(),
    agent: {
      id: "agent-1",
      descriptor,
      state: {
        permissions: permissionsBuild()
      }
    } as unknown as ToolExecutionContext["agent"],
    source: "telegram",
    messageContext: { messageId: "m1" },
    agentSystem: {
      grantPermission: options.agentSystem?.grantPermission ?? (async () => undefined),
      post: options.agentSystem?.post ?? (async () => undefined),
      agentFor: options.agentSystem?.agentFor ?? (() => "agent-1"),
      getAgentDescriptor: options.agentSystem?.getAgentDescriptor ?? (() => descriptor)
    } as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
    permissionRequestRegistry: options.registry
  };
}

function permissionsBuild(): SessionPermissions {
  return {
    workingDir: "/workspace",
    writeDirs: ["/workspace"],
    readDirs: ["/workspace"],
    network: false,
    events: false
  };
}

function decisionBuild(
  overrides: Partial<PermissionDecision> = {}
): PermissionDecision {
  return {
    token: "token-1",
    agentId: "agent-1",
    approved: false,
    permission: "@network",
    access: { kind: "network" },
    ...overrides
  };
}

async function registryResolveWhenReady(
  registry: PermissionRequestRegistry,
  decision: PermissionDecision
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (registry.resolve(decision.token, decision)) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Permission token was never registered.");
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      return (item as { type?: unknown }).type === "text";
    })
    .map((item) => (item as { text?: unknown }).text)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}
