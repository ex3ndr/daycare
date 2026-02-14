import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { channelSendToolBuild } from "./channelSendTool.js";

const toolCall = { id: "tool-1", name: "channel_send" };

describe("channelSendToolBuild", () => {
  it("sends messages with sender resolved from agent descriptor", async () => {
    const send = vi.fn(async () => ({
      message: {
        id: "m1",
        channelName: "dev",
        senderUsername: "opsbot",
        text: "hello",
        mentions: ["alice"],
        createdAt: 1
      },
      deliveredAgentIds: ["agent-leader", "agent-alice"]
    }));
    const tool = channelSendToolBuild({ send } as never);
    const result = await tool.execute(
      {
        channelName: "dev",
        text: "hello",
        mentions: ["alice"]
      },
      contextBuild(),
      toolCall
    );

    expect(send).toHaveBeenCalledWith("dev", "opsbot", "hello", ["alice"]);
    expect(result.toolMessage.isError).toBe(false);
  });
});

function contextBuild(): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: {
      workingDir: "/tmp",
      writeDirs: ["/tmp"],
      readDirs: ["/tmp"],
      network: false,
      events: false
    },
    agent: {
      id: "agent-caller",
      descriptor: {
        type: "permanent",
        id: "agent-caller",
        name: "Ops",
        username: "opsbot",
        description: "desc",
        systemPrompt: "prompt"
      }
    } as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
}

