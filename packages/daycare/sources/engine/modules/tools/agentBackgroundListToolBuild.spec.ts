import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import type { AgentState, ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentStateWrite } from "../../agents/ops/agentStateWrite.js";
import { agentBackgroundListToolBuild } from "./agentBackgroundListToolBuild.js";

const toolCall = { id: "tool-1", name: "list_background_agents" };

describe("agentBackgroundListToolBuild", () => {
  it("returns persisted background agents only", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-background-list-tool-"));
    try {
      const config = configResolve(
        {
          engine: { dataDir: dir },
          assistant: { workspaceDir: dir }
        },
        path.join(dir, "settings.json")
      );
      const userAgentId = createId();
      const subagentId = createId();
      const permanentId = createId();
      await agentDescriptorWrite(config, userAgentId, {
        type: "user",
        connector: "telegram",
        userId: "u1",
        channelId: "c1"
      });
      await agentStateWrite(config, userAgentId, stateBuild(config.defaultPermissions, 10));

      await agentDescriptorWrite(config, subagentId, {
        type: "subagent",
        id: subagentId,
        parentAgentId: userAgentId,
        name: "worker"
      });
      await agentStateWrite(config, subagentId, stateBuild(config.defaultPermissions, 20));

      await agentDescriptorWrite(config, permanentId, {
        type: "permanent",
        id: permanentId,
        name: "ops",
        description: "ops agent",
        systemPrompt: "do ops"
      });
      await agentStateWrite(config, permanentId, stateBuild(config.defaultPermissions, 30));

      const tool = agentBackgroundListToolBuild();
      const context = contextBuild(config, createId());
      const result = await tool.execute({}, context, toolCall);
      const details = result.toolMessage.details as
        | { count: number; agents: Array<{ agentId: string; parentAgentId: string | null }> }
        | undefined;

      expect(result.toolMessage.isError).toBe(false);
      expect(contentText(result.toolMessage.content)).toContain("Found 2 background agent(s):");
      expect(details?.count).toBe(2);
      expect(details?.agents.map((agent) => agent.agentId)).toEqual([permanentId, subagentId]);
      expect(details?.agents.find((agent) => agent.agentId === subagentId)?.parentAgentId).toBe(
        userAgentId
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function stateBuild(
  permissions: ToolExecutionContext["permissions"],
  updatedAt: number
): AgentState {
  return {
    context: { messages: [] },
    permissions,
    tokens: null,
    stats: {},
    createdAt: updatedAt,
    updatedAt,
    state: "active"
  };
}

function contextBuild(
  config: ReturnType<typeof configResolve>,
  agentId: string
): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: config.defaultPermissions,
    agent: { id: agentId } as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: {
      config: { current: config }
    } as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
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
