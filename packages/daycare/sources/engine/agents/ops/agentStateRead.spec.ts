import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import type { AgentState } from "./agentTypes.js";

describe("agentStateRead", () => {
  it("reads persisted context messages", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const state: AgentState = {
        context: {
          messages: [{ role: "user", content: "hello", timestamp: 1 }]
        },
        permissions: { ...config.defaultPermissions },
        tokens: null,
        stats: {},
        createdAt: 1,
        updatedAt: 2,
        state: "active"
      };
      await agentStateWrite(config, agentId, state);

      const restored = await agentStateRead(config, agentId);

      expect(restored?.context.messages).toEqual(state.context.messages);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("defaults to empty context for legacy state payloads", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const state: AgentState = {
        context: { messages: [] },
        permissions: { ...config.defaultPermissions },
        tokens: null,
        stats: {},
        createdAt: 1,
        updatedAt: 2,
        state: "active"
      };
      await agentStateWrite(config, agentId, state);

      const statePath = path.join(config.agentsDir, agentId, "state.json");
      const payload = JSON.stringify(
        {
          permissions: state.permissions,
          tokens: state.tokens,
          stats: state.stats,
          createdAt: state.createdAt,
          updatedAt: state.updatedAt,
          state: state.state
        },
        null,
        2
      );
      await writeFile(statePath, `${payload}\n`, "utf8");

      const restored = await agentStateRead(config, agentId);

      expect(restored?.context.messages).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
