import type { Tool, ToolResultMessage } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import type { InferenceRouter } from "../modules/inference/router.js";
import { appToolExecutorBuild } from "./appToolExecutorBuild.js";

describe("appToolExecutorBuild", () => {
    it("passes through allowed calls after ALLOW review", async () => {
        const execute = vi.fn(async () => toolResultBuild(false, "read ok"));
        const resolver = resolverBuild(execute);
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: true,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter: inferenceRouterBuild("ALLOW"),
            toolResolver: resolver
        });

        const result = await executor.execute(
            { id: "t1", name: "read", type: "toolCall", arguments: { path: "/tmp/a.txt" } },
            contextBuild()
        );
        expect(execute).toHaveBeenCalledTimes(1);
        expect(result.toolMessage.isError).toBe(false);
    });

    it("returns tool error when review denies", async () => {
        const execute = vi.fn(async () => toolResultBuild(false, "should not run"));
        const resolver = resolverBuild(execute);
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: true,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter: inferenceRouterBuild("DENY: blocked by rules"),
            toolResolver: resolver
        });

        const result = await executor.execute(
            { id: "t1", name: "exec", type: "toolCall", arguments: { command: "rm -rf ." } },
            contextBuild()
        );
        expect(execute).not.toHaveBeenCalled();
        expect(result.toolMessage.isError).toBe(true);
        expect(contentText(result.toolMessage)).toContain("blocked by rules");
    });

    it("returns tool error for tools outside the app allowlist", async () => {
        const execute = vi.fn(async () => toolResultBuild(false, "should not run"));
        const resolver = resolverBuild(execute);
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: true,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter: inferenceRouterBuild("ALLOW"),
            toolResolver: resolver
        });

        const result = await executor.execute(
            { id: "t1", name: "cron", type: "toolCall", arguments: { action: "list" } },
            contextBuild()
        );
        expect(execute).not.toHaveBeenCalled();
        expect(result.toolMessage.isError).toBe(true);
        expect(contentText(result.toolMessage)).toContain("not available in app sandbox");
    });

    it("includes run_python in app allowlist when resolver exposes it", () => {
        const execute = vi.fn(async () => toolResultBuild(false, "ok"));
        const resolver = resolverBuild(execute);
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: true,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter: inferenceRouterBuild("ALLOW"),
            toolResolver: resolver
        });

        expect(executor.listTools().map((tool) => tool.name)).toContain("run_python");
    });

    it("excludes request_permission from app allowlist", () => {
        const execute = vi.fn(async () => toolResultBuild(false, "ok"));
        const resolver = resolverBuild(execute);
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: true,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter: inferenceRouterBuild("ALLOW"),
            toolResolver: resolver
        });

        expect(executor.listTools().map((tool) => tool.name)).not.toContain("request_permission");
    });

    it("bypasses review model when reviewer is disabled by config", async () => {
        const execute = vi.fn(async () => toolResultBuild(false, "read ok"));
        const resolver = resolverBuild(execute);
        const complete = vi.fn(async () => ({
            providerId: "provider",
            modelId: "model",
            message: {
                role: "assistant" as const,
                content: [{ type: "text" as const, text: "DENY: should not be used" }],
                api: "openai-responses" as const,
                provider: "provider",
                model: "model",
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
                stopReason: "stop" as const,
                timestamp: Date.now()
            }
        }));
        const inferenceRouter = { complete } as unknown as InferenceRouter;
        const executor = appToolExecutorBuild({
            appId: "github-reviewer",
            appName: "GitHub Reviewer",
            appSystemPrompt: "You are a focused review assistant.",
            reviewerEnabled: false,
            rlmEnabled: false,
            sourceIntent: "Review pull requests safely.",
            rules: { allow: [], deny: [] },
            inferenceRouter,
            toolResolver: resolver
        });

        const result = await executor.execute(
            { id: "t1", name: "read", type: "toolCall", arguments: { path: "/tmp/a.txt" } },
            contextBuild()
        );

        expect(complete).not.toHaveBeenCalled();
        expect(execute).toHaveBeenCalledTimes(1);
        expect(result.toolMessage.isError).toBe(false);
    });
});

function inferenceRouterBuild(text: string): InferenceRouter {
    return {
        complete: vi.fn(async () => ({
            providerId: "provider",
            modelId: "model",
            message: {
                role: "assistant",
                content: [{ type: "text", text }],
                api: "openai-responses",
                provider: "provider",
                model: "model",
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
            }
        }))
    } as unknown as InferenceRouter;
}

function resolverBuild(execute: () => Promise<ToolExecutionResult>) {
    const schema = Type.Object({}, { additionalProperties: true });
    const tools: Tool[] = [
        { name: "read", description: "read", parameters: schema },
        { name: "write", description: "write", parameters: schema },
        { name: "edit", description: "edit", parameters: schema },
        { name: "exec", description: "exec", parameters: schema },
        { name: "run_python", description: "run_python", parameters: schema },
        { name: "request_permission", description: "request_permission", parameters: schema },
        { name: "cron", description: "cron", parameters: schema }
    ];
    return {
        listTools: (): Tool[] => tools,
        listToolsForAgent: (): Tool[] => tools,
        execute: vi.fn(async () => execute())
    };
}

function toolResultBuild(isError: boolean, text: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId: "t1",
            toolName: "read",
            content: [{ type: "text", text }],
            isError,
            timestamp: Date.now()
        },
        typedResult: { text }
    };
}

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: "/workspace",
            writeDirs: ["/workspace"]
        },
        agent: { id: "agent-1" } as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function contentText(message: ToolResultMessage): string {
    return message.content
        .filter((entry): entry is { type: "text"; text: string } => entry.type === "text")
        .map((entry) => entry.text)
        .join("\n");
}
