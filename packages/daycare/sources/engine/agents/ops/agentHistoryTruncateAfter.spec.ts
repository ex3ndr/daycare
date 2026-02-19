import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import type { Config } from "@/types";
import { agentHistoryTruncateAfter } from "./agentHistoryTruncateAfter.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

describe("agentHistoryTruncateAfter", () => {
  let tempDir: string;
  let config: Config;
  const agentId = "test-agent";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-history-truncate-"));
    config = {
      agentsDir: tempDir
    } as Config;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const buildRecord = <T extends AgentHistoryRecord>(record: T): T => record;

  it("should truncate all records after the target messageId", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "keep this", files: [], messageId: "msg-1" })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({
        type: "assistant_message",
        at: 3,
        text: "response to keep",
        files: [],
        toolCalls: [],
        tokens: null
      })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 4, text: "secret!", files: [], messageId: "msg-2" })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({
        type: "assistant_message",
        at: 5,
        text: "response with secret",
        files: [],
        toolCalls: [],
        tokens: null
      })
    );

    const result = await agentHistoryTruncateAfter(config, agentId, "msg-1", "Sensitive info removed");
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(3); // assistant, user_message msg-2, assistant

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(3); // start, user_message msg-1, note
    expect(records[0]).toEqual({ type: "start", at: 1 });
    expect(records[1]).toEqual({ type: "user_message", at: 2, text: "keep this", files: [], messageId: "msg-1" });
    expect(records[2].type).toBe("note");
    expect((records[2] as { text: string }).text).toContain("3 message(s) deleted");
    expect((records[2] as { text: string }).text).toContain("Sensitive info removed");
  });

  it("should return false if messageId not found", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "hello", files: [], messageId: "msg-1" })
    );

    const result = await agentHistoryTruncateAfter(config, agentId, "nonexistent");
    expect(result.success).toBe(false);
    expect(result.deletedCount).toBe(0);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(2);
  });

  it("should return false for empty messageId", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));

    const result = await agentHistoryTruncateAfter(config, agentId, "");
    expect(result.success).toBe(false);
    expect(result.deletedCount).toBe(0);
  });

  it("should return false if history is empty", async () => {
    const result = await agentHistoryTruncateAfter(config, agentId, "msg-1");
    expect(result.success).toBe(false);
    expect(result.deletedCount).toBe(0);
  });

  it("should return false if target is the last message", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "last", files: [], messageId: "msg-1" })
    );

    const result = await agentHistoryTruncateAfter(config, agentId, "msg-1");
    expect(result.success).toBe(false);
    expect(result.deletedCount).toBe(0);
  });

  it("should work without a reason", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "keep", files: [], messageId: "msg-1" })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 3, text: "remove", files: [], messageId: "msg-2" })
    );

    const result = await agentHistoryTruncateAfter(config, agentId, "msg-1");
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(3);
    expect((records[2] as { text: string }).text).toBe("[1 message(s) deleted]");
  });
});
