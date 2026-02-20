import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { InferenceRouter } from "../modules/inference/router.js";
import { appToolReview } from "./appToolReview.js";

describe("appToolReview", () => {
    it("returns allowed=true for ALLOW response", async () => {
        const review = await appToolReview({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            toolCall: { id: "t1", name: "read", type: "toolCall", arguments: { path: "/tmp/file" } },
            rules: { allow: [], deny: [] },
            availableTools: availableToolsBuild(),
            inferenceRouter: inferenceRouterBuild(assistantMessageBuild("ALLOW"))
        });

        expect(review).toEqual({ allowed: true });
    });

    it("returns denied with reason for DENY response", async () => {
        const review = await appToolReview({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            toolCall: { id: "t1", name: "exec", type: "toolCall", arguments: { command: "rm -rf ." } },
            rules: { allow: [], deny: [] },
            availableTools: availableToolsBuild(),
            inferenceRouter: inferenceRouterBuild(assistantMessageBuild("DENY: destructive command"))
        });

        expect(review).toEqual({ allowed: false, reason: "destructive command" });
    });

    it("denies malformed responses", async () => {
        const review = await appToolReview({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            toolCall: { id: "t1", name: "exec", type: "toolCall", arguments: { command: "echo ok" } },
            rules: { allow: [], deny: [] },
            availableTools: availableToolsBuild(),
            inferenceRouter: inferenceRouterBuild(assistantMessageBuild("maybe"))
        });

        expect(review.allowed).toBe(false);
        expect(review.reason).toContain("invalid decision");
    });

    it("includes available tool context in the review prompt", async () => {
        const complete = vi.fn(async (_context: unknown) => ({
            message: assistantMessageBuild("ALLOW"),
            providerId: "provider-1",
            modelId: "model-1"
        }));
        const inferenceRouter = { complete } as unknown as InferenceRouter;
        await appToolReview({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            rlmEnabled: true,
            sourceIntent: "Review pull requests safely.",
            toolCall: { id: "t1", name: "exec", type: "toolCall", arguments: { command: "echo ok" } },
            rules: { allow: [], deny: [] },
            availableTools: availableToolsBuild(),
            inferenceRouter
        });

        const firstCall = complete.mock.calls[0];
        expect(firstCall).toBeTruthy();
        if (!firstCall) {
            throw new Error("Expected review model call");
        }
        const context = firstCall[0] as {
            messages?: Array<{ content?: Array<{ type: string; text: string }> }>;
        };
        const prompt = context.messages?.[0]?.content?.find((item) => item.type === "text")?.text ?? "";
        expect(prompt).toContain("## Available Tools In This Sandbox");
        expect(prompt).toContain("Name: exec");
        expect(prompt).toContain("not Python exec()");
        expect(prompt).toContain("## App System Prompt");
        expect(prompt).toContain("You are a focused review assistant.");
        expect(prompt).toContain("RLM mode is enabled.");
        expect(prompt).toContain("`run_python` tool");
        expect(prompt).toContain("minimal Python runtime (Monty)");
        expect(prompt).toContain("not full CPython");
        expect(prompt).toContain("`read(...)`, `exec(...)`");
    });
});

function inferenceRouterBuild(message: AssistantMessage): InferenceRouter {
    return {
        complete: vi.fn(async () => ({
            message,
            providerId: "provider-1",
            modelId: "model-1"
        }))
    } as unknown as InferenceRouter;
}

function assistantMessageBuild(text: string): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text }],
        api: "openai-responses",
        provider: "test-provider",
        model: "test-model",
        usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0
            }
        },
        stopReason: "stop",
        timestamp: Date.now()
    };
}

function availableToolsBuild(): Array<{ name: string; description: string; parameters: unknown }> {
    return [
        {
            name: "exec",
            description: "Run a shell command in the workspace.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string" }
                },
                required: ["command"]
            }
        },
        {
            name: "read",
            description: "Read file contents.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string" }
                },
                required: ["path"]
            }
        }
    ];
}
