import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Context } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { contextForAgent } from "../context.js";
import { agentInferencePromptWrite } from "./agentInferencePromptWrite.js";

describe("agentInferencePromptWrite", () => {
    it("writes INFERENCE.md snapshot with the exact request context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-inference-prompt-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const context: Context = {
                systemPrompt: "Follow instructions.",
                messages: [
                    {
                        role: "user",
                        content: [{ type: "text", text: "hello" }],
                        timestamp: 1
                    }
                ],
                tools: []
            };
            const ctx = contextForAgent({ userId: "user-1", agentId });

            await agentInferencePromptWrite(config, ctx, {
                context,
                sessionId: "session-1",
                providersOverride: [{ id: "openai", model: "gpt-5-mini" }],
                iteration: 2
            });

            const filePath = path.join(config.agentsDir, agentId, "INFERENCE.md");
            const content = await readFile(filePath, "utf8");
            expect(content).toContain("# Inference Snapshot");
            expect(content).toContain("`session-1`");
            expect(content).toContain('"systemPrompt": "Follow instructions."');
            expect(content).toContain('"text": "hello"');
            expect(content).toContain('"id": "openai"');
            expect(content).toContain('"model": "gpt-5-mini"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
