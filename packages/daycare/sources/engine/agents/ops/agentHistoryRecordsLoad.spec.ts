import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import type { AgentHistoryRecord } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";

describe("agentHistoryRecordsLoad", () => {
  it("loads all RLM checkpoint records when valid", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-records-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const historyPath = path.join(config.agentsDir, agentId, "history.jsonl");
      await mkdir(path.dirname(historyPath), { recursive: true });

      const records: AgentHistoryRecord[] = [
        { type: "start", at: 1 },
        {
          type: "rlm_start",
          at: 2,
          toolCallId: "tool-1",
          code: "echo('x')",
          preamble: "def echo(text: str) -> str: ..."
        },
        {
          type: "rlm_tool_call",
          at: 3,
          toolCallId: "tool-1",
          snapshot: "AQID",
          printOutput: [],
          toolCallCount: 0,
          toolName: "echo",
          toolArgs: { text: "x" }
        },
        {
          type: "rlm_tool_result",
          at: 4,
          toolCallId: "tool-1",
          toolName: "echo",
          toolResult: "x",
          toolIsError: false
        },
        {
          type: "rlm_complete",
          at: 5,
          toolCallId: "tool-1",
          output: "done",
          printOutput: ["hello"],
          toolCallCount: 1,
          isError: false
        },
        {
          type: "assistant_rewrite",
          at: 6,
          assistantAt: 1,
          text: "<run_python>echo()</run_python>",
          reason: "run_python_failure_trim"
        }
      ];

      await writeFile(historyPath, records.map((record) => JSON.stringify(record)).join("\n"), "utf8");
      const loaded = await agentHistoryRecordsLoad(config, agentId);

      expect(loaded).toEqual(records);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips invalid RLM checkpoint records", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-invalid-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const historyPath = path.join(config.agentsDir, agentId, "history.jsonl");
      await mkdir(path.dirname(historyPath), { recursive: true });

      const valid: AgentHistoryRecord = {
        type: "rlm_complete",
        at: 5,
        toolCallId: "tool-1",
        output: "",
        printOutput: [],
        toolCallCount: 0,
        isError: true,
        error: "boom"
      };
      const invalidRecords = [
        {
          type: "rlm_start",
          at: 1,
          toolCallId: "",
          code: "x",
          preamble: "y"
        },
        {
          type: "rlm_tool_call",
          at: 2,
          toolCallId: "tool-1",
          snapshot: "AQID",
          printOutput: [],
          toolCallCount: -1,
          toolName: "echo",
          toolArgs: {}
        }
      ];

      const lines = [...invalidRecords.map((record) => JSON.stringify(record)), JSON.stringify(valid)];
      await writeFile(historyPath, lines.join("\n"), "utf8");
      const loaded = await agentHistoryRecordsLoad(config, agentId);

      expect(loaded).toEqual([valid]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
