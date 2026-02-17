import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { ToolResolver } from "./toolResolver.js";

describe("ToolResolver", () => {
  it('rejects non-run_python tool calls when rlmToolOnly is enabled', async () => {
    const resolver = new ToolResolver();
    resolver.register("test", {
      tool: {
        name: "read_file",
        description: "Read file.",
        parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
      },
      execute: async () => okResult("read_file", "ok")
    });

    const result = await resolver.execute(
      {
        type: "toolCall",
        id: "call-1",
        name: "read_file",
        arguments: { path: "/tmp/a.txt" }
      },
      contextBuild({ rlmToolOnly: true })
    );

    expect(result.toolMessage.isError).toBe(true);
    expect(messageText(result)).toContain('RLM mode only allows calling "run_python".');
  });

  it("allows run_python tool calls when rlmToolOnly is enabled", async () => {
    const resolver = new ToolResolver();
    resolver.register("test", {
      tool: {
        name: "run_python",
        description: "Run python.",
        parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
      },
      execute: async () => okResult("run_python", "ok")
    });

    const result = await resolver.execute(
      {
        type: "toolCall",
        id: "call-1",
        name: "run_python",
        arguments: { code: "print(1)" }
      },
      contextBuild({ rlmToolOnly: true })
    );

    expect(result.toolMessage.isError).toBe(false);
    expect(messageText(result)).toContain("ok");
  });

  it("allows non-run_python tool calls when rlmToolOnly is disabled", async () => {
    const resolver = new ToolResolver();
    resolver.register("test", {
      tool: {
        name: "read_file",
        description: "Read file.",
        parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
      },
      execute: async () => okResult("read_file", "ok")
    });

    const result = await resolver.execute(
      {
        type: "toolCall",
        id: "call-1",
        name: "read_file",
        arguments: { path: "/tmp/a.txt" }
      },
      contextBuild({ rlmToolOnly: false })
    );

    expect(result.toolMessage.isError).toBe(false);
    expect(messageText(result)).toContain("ok");
  });
});

function contextBuild(
  overrides: Partial<ToolExecutionContext> = {}
): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: {
      workingDir: "/tmp",
      writeDirs: [],
      readDirs: [],
      network: false,
      events: false
    },
    agent: null as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
    ...overrides
  };
}

function okResult(name: string, text: string): ToolExecutionResult {
  return {
    toolMessage: {
      role: "toolResult",
      toolCallId: "tool-call-1",
      toolName: name,
      content: [{ type: "text", text }],
      isError: false,
      timestamp: Date.now()
    }
  };
}

function messageText(result: ToolExecutionResult): string {
  return result.toolMessage.content
    .filter((entry) => entry.type === "text")
    .map((entry) => ("text" in entry && typeof entry.text === "string" ? entry.text : ""))
    .join("\n");
}
