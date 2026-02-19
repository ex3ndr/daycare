import { describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";
import { MontySnapshot } from "@pydantic/monty";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { montyRuntimePreambleBuild } from "../monty/montyRuntimePreambleBuild.js";
import { rlmExecute } from "./rlmExecute.js";

const baseTools = [
  {
    name: "echo",
    description: "Echo back text.",
    parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
  },
  {
    name: "fail_tool",
    description: "Always fails.",
    parameters: Type.Object({}, { additionalProperties: false })
  }
];

describe("rlmExecute", () => {
  it("executes a tool call and returns final output", async () => {
    const resolver = createResolver(async (name, args) => {
      if (name !== "echo") {
        throw new Error(`Unexpected tool ${name}`);
      }
      const payload = args as { text: string };
      return okResult(name, String(payload.text));
    });

    const result = await rlmExecute(
      "value = echo('hello')\nvalue",
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "tool-call-1"
    );

    expect(result.output).toBe("{\"text\":\"hello\"}");
    expect(result.toolCallCount).toBe(1);
    expect(result.printOutput).toEqual([]);
  });

  it("supports chained calls and catches tool errors in python", async () => {
    const resolver = createResolver(async (name, args) => {
      if (name === "echo") {
        const payload = args as { text: string };
        return okResult(name, `echo:${payload.text}`);
      }
      if (name === "fail_tool") {
        return errorResult(name, "boom");
      }
      throw new Error(`Unexpected tool ${name}`);
    });

    const code = [
      "first = echo('one')",
      "try:",
      "    fail_tool()",
      "except ToolError:",
      "    pass",
      "second = echo(first)",
      "second"
    ].join("\n");

    const result = await rlmExecute(
      code,
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "tool-call-1"
    );

    expect(result.output).toBe("{\"text\":\"echo:[object Object]\"}");
    expect(result.toolCallCount).toBe(3);
  });

  it("captures print output", async () => {
    const resolver = createResolver(async (name) => {
      throw new Error(`Unexpected tool ${name}`);
    });

    const result = await rlmExecute(
      "print('hello', 'world')\n'done'",
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "tool-call-1"
    );

    expect(result.output).toBe("done");
    expect(result.printOutput).toEqual(["hello world"]);
    expect(result.toolCallCount).toBe(0);
  });

  it("reloads snapshot before resume so duration limits reset after tool calls", async () => {
    const loadSpy = vi.spyOn(MontySnapshot, "load");
    const resolver = createResolver(async (name, args) => {
      if (name !== "echo") {
        throw new Error(`Unexpected tool ${name}`);
      }
      const payload = args as { text: string };
      return okResult(name, payload.text);
    });

    await rlmExecute(
      "value = echo('hello')\nvalue",
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "tool-call-1"
    );

    expect(loadSpy).toHaveBeenCalledTimes(1);
    loadSpy.mockRestore();
  });

  it("emits checkpoint records through history callback", async () => {
    const resolver = createResolver(async (name, args) => {
      if (name !== "echo") {
        throw new Error(`Unexpected tool ${name}`);
      }
      const payload = args as { text: string };
      return okResult(name, payload.text);
    });
    const records: string[] = [];

    await rlmExecute(
      "value = echo('hello')\nvalue",
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "outer-run-python",
      async (record) => {
        records.push(record.type);
      }
    );

    expect(records).toEqual(["rlm_start", "rlm_tool_call", "rlm_tool_result", "rlm_complete"]);
  });
});

function createResolver(
  handler: (name: string, args: unknown) => Promise<ToolExecutionResult>
): ToolResolverApi {
  return {
    listTools: () => baseTools,
    execute: vi.fn(async (toolCall) => handler(toolCall.name, toolCall.arguments))
  };
}

function createContext(): ToolExecutionContext {
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
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
}

function okResult(name: string, text: string): ToolExecutionResult {
  return {
    toolMessage: {
      role: "toolResult",
      toolCallId: "1",
      toolName: name,
      content: [{ type: "text", text }],
      isError: false,
      timestamp: Date.now()
    },
    typedResult: { text }
  };
}

function errorResult(name: string, text: string): ToolExecutionResult {
  return {
    toolMessage: {
      role: "toolResult",
      toolCallId: "1",
      toolName: name,
      content: [{ type: "text", text }],
      isError: true,
      timestamp: Date.now()
    },
    typedResult: { text }
  };
}
