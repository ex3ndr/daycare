import { describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";

import type {
  AgentHistoryRlmStartRecord,
  AgentHistoryRlmToolCallRecord,
  ToolExecutionContext,
  ToolExecutionResult
} from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { montyRuntimePreambleBuild } from "../monty/montyRuntimePreambleBuild.js";
import { rlmExecute } from "./rlmExecute.js";
import { rlmRestore } from "./rlmRestore.js";

const baseTools = [
  {
    name: "echo",
    description: "Echo back text.",
    parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
  },
  {
    name: "run_python",
    description: "meta",
    parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
  }
];

describe("rlmRestore", () => {
  it("restores from snapshot, injects restart error, and continues execution", async () => {
    const resolver = createResolver(async (_name, args) => {
      const payload = args as { text: string };
      return okResult("echo", payload.text);
    });
    const { startRecord, snapshotRecord } = await interruptedSnapshotBuild(
      [
        "try:",
        "    value = echo('first')",
        "except ToolError:",
        "    value = 'recovered'",
        "result = echo(value)",
        "result"
      ].join("\n"),
      resolver
    );

    const callbackRecords: string[] = [];
    const result = await rlmRestore(
      snapshotRecord,
      startRecord,
      resolver,
      createContext(),
      async (record) => {
        callbackRecords.push(record.type);
      }
    );

    expect(result.output).toBe("{\"text\":\"recovered\"}");
    expect(result.toolCallCount).toBe(1);
    expect(callbackRecords).toEqual(["rlm_tool_call", "rlm_tool_result", "rlm_complete"]);
  });

  it("emits completion when restore immediately finishes after restart error", async () => {
    const resolver = createResolver(async (_name, args) => {
      const payload = args as { text: string };
      return okResult("echo", payload.text);
    });
    const { startRecord, snapshotRecord } = await interruptedSnapshotBuild(
      [
        "try:",
        "    echo('first')",
        "except ToolError:",
        "    pass",
        "'done'"
      ].join("\n"),
      resolver
    );

    const callbackRecords: string[] = [];
    const result = await rlmRestore(
      snapshotRecord,
      startRecord,
      resolver,
      createContext(),
      async (record) => {
        callbackRecords.push(record.type);
      }
    );

    expect(result.output).toBe("done");
    expect(result.toolCallCount).toBe(0);
    expect(callbackRecords).toEqual(["rlm_complete"]);
  });
});

async function interruptedSnapshotBuild(
  code: string,
  resolver: ToolResolverApi
): Promise<{ startRecord: AgentHistoryRlmStartRecord; snapshotRecord: AgentHistoryRlmToolCallRecord }> {
  const historyRecords: Array<AgentHistoryRlmStartRecord | AgentHistoryRlmToolCallRecord> = [];
  const crash = new Error("simulated process crash");
  await expect(
    rlmExecute(
      code,
      montyRuntimePreambleBuild(),
      createContext(),
      resolver,
      "run-python-call-1",
      async (record) => {
        if (record.type === "rlm_start") {
          historyRecords.push(record);
          return;
        }
        if (record.type === "rlm_tool_call") {
          historyRecords.push(record);
          throw crash;
        }
      }
    )
  ).rejects.toThrow("simulated process crash");

  const startRecord = historyRecords.find((record) => record.type === "rlm_start");
  const snapshotRecord = historyRecords.find((record) => record.type === "rlm_tool_call");
  if (!startRecord || !snapshotRecord) {
    throw new Error("Failed to capture interrupted RLM snapshot records.");
  }
  return { startRecord, snapshotRecord };
}

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
