import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryLoadAll } from "./agentHistoryLoadAll.js";
import type { AgentHistoryRecord } from "@/types";

const buildRecord = (record: AgentHistoryRecord) => record;

describe("agentHistoryLoadAll", () => {
  it("returns records across reset markers", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-all-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );

      await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
      await agentHistoryAppend(
        config,
        agentId,
        buildRecord({ type: "user_message", at: 2, text: "before reset", files: [] })
      );
      await agentHistoryAppend(config, agentId, buildRecord({ type: "reset", at: 3 }));
      await agentHistoryAppend(
        config,
        agentId,
        buildRecord({ type: "user_message", at: 4, text: "after reset", files: [] })
      );

      const records = await agentHistoryLoadAll(config, agentId);

      expect(records).toHaveLength(4);
      expect(records[0]).toEqual({ type: "start", at: 1 });
      expect(records[1]).toEqual({
        type: "user_message",
        at: 2,
        text: "before reset",
        files: []
      });
      expect(records[2]).toEqual({ type: "reset", at: 3 });
      expect(records[3]).toEqual({
        type: "user_message",
        at: 4,
        text: "after reset",
        files: []
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
