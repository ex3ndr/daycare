import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { agentSystemPromptWrite } from "./agentSystemPromptWrite.js";

describe("agentSystemPromptWrite", () => {
  it("writes a session prompt snapshot and skips unchanged prompts", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "claybot-system-prompt-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );

      const firstPrompt = "System prompt v1";
      const firstWrite = await agentSystemPromptWrite(config, agentId, firstPrompt);
      expect(firstWrite).toBe(true);

      const filePath = path.join(config.agentsDir, agentId, "SYSTEM.md");
      const firstContent = await readFile(filePath, "utf8");
      expect(firstContent).toBe(`${firstPrompt}\n`);

      const secondWrite = await agentSystemPromptWrite(config, agentId, firstPrompt);
      expect(secondWrite).toBe(false);

      const secondPrompt = "System prompt v2";
      const thirdWrite = await agentSystemPromptWrite(config, agentId, secondPrompt);
      expect(thirdWrite).toBe(true);

      const secondContent = await readFile(filePath, "utf8");
      expect(secondContent).toBe(`${secondPrompt}\n`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
