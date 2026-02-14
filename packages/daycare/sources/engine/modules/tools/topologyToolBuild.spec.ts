import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AgentState, ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentStateWrite } from "../../agents/ops/agentStateWrite.js";
import type { CronTaskWithPaths } from "../../cron/cronTypes.js";
import type { Crons } from "../../cron/crons.js";
import type { HeartbeatDefinition } from "../../heartbeat/heartbeatTypes.js";
import type { Signals } from "../../signals/signals.js";
import type { SignalSubscription } from "../../signals/signalTypes.js";
import { topologyToolBuild } from "./topologyToolBuild.js";

const toolCall = { id: "tool-1", name: "topology" };

describe("topologyToolBuild", () => {
  it("returns empty sections when no topology entries exist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
    try {
      const config = configResolve(
        {
          engine: { dataDir: dir },
          assistant: { workspaceDir: dir }
        },
        path.join(dir, "settings.json")
      );

      const tool = topologyToolBuild(
        { listTasks: async () => [] } as unknown as Crons,
        { listSubscriptions: () => [] } as unknown as Signals,
        { list: () => [] } as never
      );
      const result = await tool.execute(
        {},
        contextBuild(config, {
          callerAgentId: "agent-caller",
          heartbeatTasks: []
        }),
        toolCall
      );

      expect(result.toolMessage.isError).toBe(false);
      const text = contentText(result.toolMessage.content);
      expect(text).toContain("## Agents (0)");
      expect(text).toContain("## Cron Tasks (0)");
      expect(text).toContain("## Heartbeat Tasks (0)");
      expect(text).toContain("## Signal Subscriptions (0)");
      expect(text).toContain("## Channels (0)");

      const details = result.toolMessage.details as
        | {
            callerAgentId: string;
            agents: unknown[];
            crons: unknown[];
            heartbeats: unknown[];
            signalSubscriptions: unknown[];
            channels: unknown[];
          }
        | undefined;
      expect(details).toEqual({
        callerAgentId: "agent-caller",
        agents: [],
        crons: [],
        heartbeats: [],
        signalSubscriptions: [],
        channels: []
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns populated topology with expected section formatting", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
    try {
      const config = configResolve(
        {
          engine: { dataDir: dir },
          assistant: { workspaceDir: dir }
        },
        path.join(dir, "settings.json")
      );

      await agentDescriptorWrite(config, "agent-caller", {
        type: "subagent",
        id: "agent-caller",
        parentAgentId: "agent-other",
        name: "monitor"
      });
      await agentStateWrite(config, "agent-caller", stateBuild(config.defaultPermissions, 50));

      await agentDescriptorWrite(config, "agent-other", {
        type: "system",
        tag: "cron"
      });
      await agentStateWrite(config, "agent-other", stateBuild(config.defaultPermissions, 10));

      const tool = topologyToolBuild(
        {
          listTasks: async () => [
            cronTaskBuild({ id: "cleanup", name: "Cleanup", schedule: "0 0 * * 0", enabled: false }),
            cronTaskBuild({
              id: "daily-report",
              name: "Daily Report",
              schedule: "0 9 * * *",
              enabled: true,
              agentId: "agent-caller"
            })
          ]
        } as unknown as Crons,
        {
          listSubscriptions: () => [
            signalSubscriptionBuild({
              agentId: "agent-other",
              pattern: "deploy:done",
              silent: false
            }),
            signalSubscriptionBuild({
              agentId: "agent-caller",
              pattern: "build:*",
              silent: true
            })
          ]
        } as unknown as Signals,
        {
          list: () => [
            {
              id: "channel-dev",
              name: "dev",
              leader: "agent-other",
              members: [
                { agentId: "agent-caller", username: "monitor", joinedAt: 1 }
              ],
              createdAt: 1,
              updatedAt: 1
            }
          ]
        } as never
      );

      const result = await tool.execute(
        {},
        contextBuild(config, {
          callerAgentId: "agent-third",
          heartbeatTasks: [
            {
              id: "check-health",
              title: "Health Check",
              prompt: "Check status",
              filePath: "/tmp/heartbeat/check-health.md",
              lastRunAt: "2025-01-15T10:00:00Z"
            }
          ]
        }),
        toolCall
      );

      const text = contentText(result.toolMessage.content);
      expect(text).toContain("## Agents (2)");
      expect(text).toContain("agent-caller type=subagent label=\"monitor\" lifecycle=active");
      expect(text).toContain("## Cron Tasks (2)");
      expect(text).toContain(
        "daily-report: Daily Report schedule=\"0 9 * * *\" enabled=true"
      );
      expect(text).toContain("## Heartbeat Tasks (1)");
      expect(text).toContain("check-health: Health Check lastRun=2025-01-15T10:00:00Z");
      expect(text).toContain("## Signal Subscriptions (2)");
      expect(text).toContain("agent=agent-other pattern=deploy:done silent=false");
      expect(text).toContain("## Channels (1)");
      expect(text).toContain("#dev leader=agent-other members=@monitor(agent-caller)");

      const details = result.toolMessage.details as
        | {
            agents: Array<{ id: string }>;
            crons: Array<{ id: string }>;
            heartbeats: Array<{ id: string }>;
            signalSubscriptions: Array<{ agentId: string }>;
            channels: Array<{ id: string }>;
          }
        | undefined;
      expect(details?.agents).toHaveLength(2);
      expect(details?.crons).toHaveLength(2);
      expect(details?.heartbeats).toHaveLength(1);
      expect(details?.signalSubscriptions).toHaveLength(2);
      expect(details?.channels).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks caller-owned items with (You) and isYou=true", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-topology-tool-"));
    try {
      const config = configResolve(
        {
          engine: { dataDir: dir },
          assistant: { workspaceDir: dir }
        },
        path.join(dir, "settings.json")
      );

      await agentDescriptorWrite(config, "agent-caller", {
        type: "user",
        connector: "telegram",
        userId: "u1",
        channelId: "c1"
      });
      await agentStateWrite(config, "agent-caller", stateBuild(config.defaultPermissions, 100));

      const tool = topologyToolBuild(
        {
          listTasks: async () => [
            cronTaskBuild({
              id: "daily-report",
              name: "Daily Report",
              schedule: "0 9 * * *",
              enabled: true,
              agentId: "agent-caller"
            })
          ]
        } as unknown as Crons,
        {
          listSubscriptions: () => [
            signalSubscriptionBuild({
              agentId: "agent-caller",
              pattern: "build:*",
              silent: true
            })
          ]
        } as unknown as Signals,
        {
          list: () => []
        } as never
      );

      const result = await tool.execute(
        {},
        contextBuild(config, {
          callerAgentId: "agent-caller",
          heartbeatTasks: [
            {
              id: "check-health",
              title: "Health Check",
              prompt: "Check status",
              filePath: "/tmp/heartbeat/check-health.md"
            }
          ]
        }),
        toolCall
      );

      const text = contentText(result.toolMessage.content);
      expect(text).toContain("agent-caller (You) type=user");
      expect(text).toContain("enabled=true (You)");
      expect(text).toContain("silent=true (You)");
      expect(text).not.toContain("check-health: Health Check lastRun=never (You)");

      const details = result.toolMessage.details as
        | {
            agents: Array<{ isYou: boolean }>;
            crons: Array<{ isYou: boolean }>;
            signalSubscriptions: Array<{ isYou: boolean }>;
          }
        | undefined;
      expect(details?.agents[0]?.isYou).toBe(true);
      expect(details?.crons[0]?.isYou).toBe(true);
      expect(details?.signalSubscriptions[0]?.isYou).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function contextBuild(
  config: ReturnType<typeof configResolve>,
  options: {
    callerAgentId: string;
    heartbeatTasks: HeartbeatDefinition[];
  }
): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: config.defaultPermissions,
    agent: { id: options.callerAgentId } as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: {
      config: { current: config }
    } as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: {
      listTasks: async () => options.heartbeatTasks
    } as unknown as ToolExecutionContext["heartbeats"]
  };
}

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

function cronTaskBuild(input: {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agentId?: string;
}): CronTaskWithPaths {
  return {
    id: input.id,
    taskUid: `${input.id}-uid`,
    name: input.name,
    schedule: input.schedule,
    prompt: "prompt",
    enabled: input.enabled,
    agentId: input.agentId,
    taskPath: `/tmp/cron/${input.id}.md`,
    memoryPath: `/tmp/cron/${input.id}.memory.md`,
    filesPath: `/tmp/cron/${input.id}`
  };
}

function signalSubscriptionBuild(input: {
  agentId: string;
  pattern: string;
  silent: boolean;
}): SignalSubscription {
  return {
    agentId: input.agentId,
    pattern: input.pattern,
    silent: input.silent,
    createdAt: 1,
    updatedAt: 1
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
