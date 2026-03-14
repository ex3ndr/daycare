import { describe, expect, it, vi } from "vitest";

import { messageContentExtractText } from "../engine/messages/messageContentExtractText.js";
import type { InferenceRouter } from "../engine/modules/inference/router.js";
import { evalHarnessCreate } from "./evalHarness.js";
import { evalRun } from "./evalRun.js";

describe("evalRun", () => {
    it("runs a single-turn scenario and captures history", async () => {
        const harness = await evalHarnessCreate({
            inferenceRouter: evalInferenceRouterBuild(["hello from eval"])
        });

        try {
            const trace = await evalRun(
                {
                    name: "single-turn",
                    agent: {
                        kind: "agent",
                        path: "eval-agent"
                    },
                    turns: [{ role: "user", text: "Hello" }]
                },
                harness
            );

            const assistantRecord = trace.history.find((record) => record.type === "assistant_message");
            if (!assistantRecord || assistantRecord.type !== "assistant_message") {
                throw new Error("Expected assistant history record");
            }

            expect(trace.agentId).toBeTruthy();
            expect(trace.setup.result).toEqual({ type: "reset", ok: true });
            expect(trace.turnResults).toHaveLength(1);
            expect(trace.turnResults[0]?.result).toEqual({ type: "message", responseText: "hello from eval" });
            expect(messageContentExtractText(assistantRecord.content)).toBe("hello from eval");
            expect(trace.events.some((event) => event.type === "agent.created")).toBe(true);
        } finally {
            await harness.cleanup();
        }
    });

    it("runs multi-turn scenarios sequentially and snapshots history after each turn", async () => {
        const harness = await evalHarnessCreate({
            inferenceRouter: evalInferenceRouterBuild(["first reply", "second reply"])
        });

        try {
            const trace = await evalRun(
                {
                    name: "multi-turn",
                    agent: {
                        kind: "agent",
                        path: "eval-agent"
                    },
                    turns: [
                        { role: "user", text: "First question" },
                        { role: "user", text: "Second question" }
                    ]
                },
                harness
            );

            const firstSnapshotUsers =
                trace.turnResults[0]?.history.filter((record) => record.type === "user_message").length ?? 0;
            const secondSnapshotUsers =
                trace.turnResults[1]?.history.filter((record) => record.type === "user_message").length ?? 0;

            expect(trace.turnResults).toHaveLength(2);
            expect(trace.turnResults[0]?.result).toEqual({ type: "message", responseText: "first reply" });
            expect(trace.turnResults[1]?.result).toEqual({ type: "message", responseText: "second reply" });
            expect(firstSnapshotUsers).toBe(1);
            expect(secondSnapshotUsers).toBe(2);
        } finally {
            await harness.cleanup();
        }
    });
});

function evalInferenceRouterBuild(texts: string[]): InferenceRouter {
    let index = 0;

    return {
        complete: vi.fn(async () => {
            const text = texts[Math.min(index, texts.length - 1)] ?? "ok";
            index += 1;
            return {
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant" as const,
                    content: [{ type: "text" as const, text }],
                    api: "openai-responses" as const,
                    provider: "openai",
                    model: "gpt-4.1",
                    usage: {
                        input: 10,
                        output: 5,
                        cacheRead: 0,
                        cacheWrite: 0,
                        totalTokens: 15,
                        cost: {
                            input: 0,
                            output: 0,
                            cacheRead: 0,
                            cacheWrite: 0,
                            total: 0
                        }
                    },
                    stopReason: "stop" as const,
                    timestamp: Date.now()
                }
            };
        })
    } as unknown as InferenceRouter;
}
