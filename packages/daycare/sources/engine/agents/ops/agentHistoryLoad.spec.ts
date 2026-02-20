import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { storageUpgrade } from "../../../storage/storageUpgrade.js";
import { agentDescriptorWrite } from "./agentDescriptorWrite.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryLoad } from "./agentHistoryLoad.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import { sessionDbCreate } from "../../../storage/sessionDbCreate.js";

describe("agentHistoryLoad", () => {
  it("returns records from the active session only", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await storageUpgrade(config);
      await agentDescriptorWrite(config, agentId, {
        type: "cron",
        id: agentId,
        name: "history"
      });

      const initial = await agentStateRead(config, agentId);
      if (!initial) {
        throw new Error("State missing");
      }

      const firstSession = await sessionDbCreate(config, { agentId, createdAt: 1 });
      await agentStateWrite(config, agentId, { ...initial, activeSessionId: firstSession });
      await agentHistoryAppend(config, agentId, {
        type: "user_message",
        at: 2,
        text: "first",
        files: []
      });

      const secondSession = await sessionDbCreate(config, { agentId, createdAt: 3 });
      await agentStateWrite(config, agentId, {
        ...initial,
        activeSessionId: secondSession,
        updatedAt: 3
      });
      await agentHistoryAppend(config, agentId, {
        type: "user_message",
        at: 4,
        text: "second",
        files: []
      });

      const records = await agentHistoryLoad(config, agentId);
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ type: "user_message", at: 4, text: "second", files: [] });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
