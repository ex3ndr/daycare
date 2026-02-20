import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { sessionDbCreate } from "../../../storage/sessionDbCreate.js";
import { agentDescriptorWrite } from "./agentDescriptorWrite.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import type { AgentState } from "./agentTypes.js";

describe("agentStateRead", () => {
  it("reads persisted state and resolves inference session id from active session", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await agentDescriptorWrite(config, agentId, {
        type: "cron",
        id: agentId,
        name: "state"
      });
      const sessionId = await sessionDbCreate(config, {
        agentId,
        inferenceSessionId: "session-1",
        createdAt: 1
      });

      const state: AgentState = {
        context: {
          messages: [{ role: "user", content: "hello", timestamp: 1 }]
        },
        activeSessionId: sessionId,
        permissions: { ...config.defaultPermissions },
        tokens: null,
        stats: {},
        createdAt: 1,
        updatedAt: 2,
        state: "active"
      };
      await agentStateWrite(config, agentId, state);

      const restored = await agentStateRead(config, agentId);

      expect(restored?.context.messages).toEqual([]);
      expect(restored?.inferenceSessionId).toBe("session-1");
      expect(restored?.activeSessionId).toBe(sessionId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when state does not exist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );

      const restored = await agentStateRead(config, agentId);
      expect(restored).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads dead lifecycle state", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await agentDescriptorWrite(config, agentId, {
        type: "cron",
        id: agentId,
        name: "state"
      });
      const state: AgentState = {
        context: { messages: [] },
        permissions: { ...config.defaultPermissions },
        tokens: null,
        stats: {},
        createdAt: 1,
        updatedAt: 2,
        state: "dead"
      };
      await agentStateWrite(config, agentId, state);

      const restored = await agentStateRead(config, agentId);

      expect(restored?.state).toBe("dead");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
