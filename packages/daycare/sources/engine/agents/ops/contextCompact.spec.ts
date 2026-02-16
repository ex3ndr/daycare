import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ProviderSettings } from "../../../settings.js";
import { contextCompact } from "./contextCompact.js";

const providers: ProviderSettings[] = [{ id: "openai" }];

function buildAssistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "gpt-4.1",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "stop",
    timestamp: Date.now()
  };
}

function buildContext(): Context {
  return {
    messages: [{ role: "user", content: "hello", timestamp: Date.now() }]
  };
}

describe("contextCompact", () => {
  it("returns one compacted summary message", async () => {
    const complete = vi.fn(async () => ({
      message: buildAssistantMessage("Summary"),
      providerId: "openai",
      modelId: "gpt-4.1"
    }));
    const inferenceRouter = { complete } as unknown as InferenceRouter;

    const compacted = await contextCompact({
      context: buildContext(),
      inferenceRouter,
      providers
    });

    const messages = compacted.messages ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("assistant");
    expect(messages[0]?.content).toEqual([{ type: "text", text: "Summary" }]);
  });

  it("adds an explicit compaction instruction as the final user message", async () => {
    let receivedContext: Context | undefined;
    const complete = vi.fn(async (context: Context) => {
      receivedContext = context;
      return {
        message: buildAssistantMessage("Summary"),
        providerId: "openai",
        modelId: "gpt-4.1"
      };
    });
    const inferenceRouter = { complete } as unknown as InferenceRouter;

    await contextCompact({
      context: buildContext(),
      inferenceRouter,
      providers
    });

    const lastMessage = receivedContext?.messages.at(-1);
    expect(lastMessage?.role).toBe("user");
    expect(lastMessage?.content).toBe(
      "Summarize the conversation above into a compact context checkpoint. " +
      "Follow the system prompt format exactly. " +
      "Do not continue the conversation."
    );
  });

  it("returns an empty compacted context when summary text is empty", async () => {
    const complete = vi.fn(async () => ({
      message: buildAssistantMessage("  "),
      providerId: "openai",
      modelId: "gpt-4.1"
    }));
    const inferenceRouter = { complete } as unknown as InferenceRouter;

    const compacted = await contextCompact({
      context: buildContext(),
      inferenceRouter,
      providers
    });

    expect(compacted.messages).toEqual([]);
  });

  it("forwards abort signal to inference router", async () => {
    let receivedSignal: AbortSignal | undefined;
    const complete = vi.fn(async (
      _context: Context,
      _sessionId: string,
      options?: { signal?: AbortSignal }
    ) => {
      receivedSignal = options?.signal;
      return {
        message: buildAssistantMessage("Summary"),
        providerId: "openai",
        modelId: "gpt-4.1"
      };
    });
    const inferenceRouter = { complete } as unknown as InferenceRouter;
    const controller = new AbortController();

    await contextCompact({
      context: buildContext(),
      inferenceRouter,
      providers,
      signal: controller.signal
    });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(receivedSignal).toBe(controller.signal);
  });

  it("writes per-agent compaction markdown logs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-context-compact-"));
    try {
      const complete = vi.fn(async () => ({
        message: buildAssistantMessage("Summary for logging"),
        providerId: "openai",
        modelId: "gpt-4.1"
      }));
      const inferenceRouter = { complete } as unknown as InferenceRouter;

      await contextCompact({
        context: buildContext(),
        inferenceRouter,
        providers,
        compactionLog: {
          agentsDir: dir,
          agentId: "agent-1"
        }
      });

      const agentDir = path.join(dir, "agent-1");
      const entries = await readdir(agentDir);
      const logName = entries.find((entry) => entry.startsWith("compaction_") && entry.endsWith(".md"));
      expect(logName).toBeTruthy();
      const raw = await readFile(path.join(agentDir, logName ?? ""), "utf8");
      expect(raw).toContain("### Request Context");
      expect(raw).toContain("### Inference Response");
      expect(raw).toContain("Summary for logging");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
