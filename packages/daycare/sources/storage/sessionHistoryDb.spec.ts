import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import type { AgentDescriptor } from "@/types";
import { configResolve } from "../config/configResolve.js";
import { agentDbWrite } from "./agentDbWrite.js";
import { sessionDbCreate } from "./sessionDbCreate.js";
import { sessionHistoryDbAppend } from "./sessionHistoryDbAppend.js";
import { sessionHistoryDbLoad } from "./sessionHistoryDbLoad.js";
import { sessionHistoryDbLoadAll } from "./sessionHistoryDbLoadAll.js";
import { storageUpgrade } from "./storageUpgrade.js";

describe("sessionHistoryDb", () => {
  it("appends and loads records for one session", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-history-db-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await storageUpgrade(config);

      const agentId = createId();
      const descriptor: AgentDescriptor = {
        type: "cron",
        id: agentId,
        name: "cron"
      };
      await agentDbWrite(config, {
        id: agentId,
        type: descriptor.type,
        descriptor,
        activeSessionId: null,
        permissions: config.defaultPermissions,
        tokens: null,
        stats: {},
        lifecycle: "active",
        createdAt: 1,
        updatedAt: 1
      });

      const sessionId = await sessionDbCreate(config, { agentId, createdAt: 10 });
      await sessionHistoryDbAppend(config, {
        sessionId,
        record: { type: "user_message", at: 11, text: "hello", files: [] }
      });
      await sessionHistoryDbAppend(config, {
        sessionId,
        record: { type: "note", at: 12, text: "done" }
      });

      const records = await sessionHistoryDbLoad(config, sessionId);
      expect(records).toEqual([
        { type: "user_message", at: 11, text: "hello", files: [] },
        { type: "note", at: 12, text: "done" }
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads all records across sessions in order", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-history-db-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await storageUpgrade(config);

      const agentId = createId();
      const descriptor: AgentDescriptor = {
        type: "cron",
        id: agentId,
        name: "cron"
      };
      await agentDbWrite(config, {
        id: agentId,
        type: descriptor.type,
        descriptor,
        activeSessionId: null,
        permissions: config.defaultPermissions,
        tokens: null,
        stats: {},
        lifecycle: "active",
        createdAt: 1,
        updatedAt: 1
      });

      const sessionA = await sessionDbCreate(config, { agentId, createdAt: 10 });
      const sessionB = await sessionDbCreate(config, { agentId, createdAt: 20 });
      await sessionHistoryDbAppend(config, {
        sessionId: sessionA,
        record: { type: "note", at: 11, text: "A1" }
      });
      await sessionHistoryDbAppend(config, {
        sessionId: sessionB,
        record: { type: "note", at: 21, text: "B1" }
      });

      const all = await sessionHistoryDbLoadAll(config, agentId);
      expect(all).toEqual([
        { type: "note", at: 11, text: "A1" },
        { type: "note", at: 21, text: "B1" }
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
