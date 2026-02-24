import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssistantMessage, Context, Tool, ToolCall } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type { AgentSkill, Connector, ToolExecutionResult } from "@/types";
import type { AuthStore } from "../../../auth/store.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { Memory } from "../../memory/memory.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import { ToolResolver } from "../../modules/toolResolver.js";
import type { Skills } from "../../skills/skills.js";
import type { Agent } from "../agent.js";
import type { AgentSystem } from "../agentSystem.js";
import { contextForAgent } from "../context.js";
import { agentLoopRun } from "./agentLoopRun.js";
import type { AgentHistoryRecord, AgentMessage } from "./agentTypes.js";

describe("agentLoopRun", () => {
    it("treats provider error responses with token wording as normal inference failures", async () => {
        const connectorSend = vi.fn(async (_targetId: string, _message: unknown) => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([], {
                stopReason: "error",
                errorMessage: "maximum number of tokens per minute reached"
            })
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        const result = await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver }));

        expect(result.contextOverflow).toBeUndefined();
        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "Inference failed.",
            replyToMessageId: undefined
        });
    });

    it("returns context overflow for anthropic prompt-too-long invalid request errors", async () => {
        const connectorSend = vi.fn(async (_targetId: string, _message: unknown) => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi.fn(async () => ({
                message: assistantMessageBuild([], {
                    stopReason: "error",
                    errorMessage:
                        '400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 216326 tokens > 200000 maximum"},"request_id":"req_011CYLhsSnjf9m1xYbYsiK7c"}'
                }),
                providerId: "anthropic",
                modelId: "claude-opus-4-5"
            }))
        } as unknown as InferenceRouter;
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });
        const notifySubagentFailure = vi.fn(async () => undefined);
        const options = optionsBuild({ entry, context, connector, inferenceRouter, toolResolver });
        options.notifySubagentFailure = notifySubagentFailure;

        const result = await agentLoopRun(options);

        expect(result.contextOverflow).toBe(true);
        expect(result.contextOverflowTokens).toBe(216_326);
        expect(connectorSend).not.toHaveBeenCalled();
        expect(notifySubagentFailure).not.toHaveBeenCalled();
    });

    it("treats thrown errors with context wording as normal inference failures", async () => {
        const connectorSend = vi.fn(async (_targetId: string, _message: unknown) => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi.fn(async () => {
                throw new Error("context length exceeded");
            })
        } as unknown as InferenceRouter;
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        const result = await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver }));

        expect(result.contextOverflow).toBeUndefined();
        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "Inference failed.",
            replyToMessageId: undefined
        });
    });

    it("does not auto-send files from tool results when model has no final text", async () => {
        const connectorSend = vi.fn(async (_targetId: string, _message: unknown) => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([toolCallBuild("call-1", "generate_image", { prompt: "draw cat" })]),
            assistantMessageBuild([])
        ]);

        const toolResolver = toolResolverBuild(async (toolCall) => {
            if (toolCall.name !== "generate_image") {
                throw new Error(`Unexpected tool: ${toolCall.name}`);
            }
            return toolResultGeneratedBuild("/workspace/files/generated-image.png", toolCall.id, toolCall.name);
        });

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        expect(connectorSend).not.toHaveBeenCalled();
    });

    it("reads skills via facade before each inference call", async () => {
        const firstSkills: AgentSkill[] = [
            {
                id: "config:alpha",
                name: "alpha",
                description: "first",
                sourcePath: "/tmp/alpha/SKILL.md",
                source: "config"
            }
        ];
        const secondSkills: AgentSkill[] = [
            {
                id: "config:beta",
                name: "beta",
                description: "second",
                sourcePath: "/tmp/beta/SKILL.md",
                source: "config"
            }
        ];
        const skillsList = vi
            .fn(async (): Promise<AgentSkill[]> => firstSkills)
            .mockResolvedValueOnce(firstSkills)
            .mockResolvedValueOnce(secondSkills);
        const syncToActive = vi.fn(async () => undefined);
        const skills = { list: skillsList, syncToActive } as unknown as Skills;
        const tools: Tool[] = [
            {
                name: "run_python",
                description: "run python",
                parameters: {} as Tool["parameters"]
            }
        ];
        const toolDescriptionsSeen: string[] = [];
        const toolResolverSkills: AgentSkill[][] = [];
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi
                .fn()
                .mockImplementationOnce(async (incomingContext: Context) => {
                    toolDescriptionsSeen.push(String(incomingContext.tools?.[0]?.description ?? ""));
                    return {
                        message: assistantMessageBuild([toolCallBuild("call-1", "run_python", { code: "print(1)" })]),
                        providerId: "provider-1",
                        modelId: "model-1"
                    };
                })
                .mockImplementationOnce(async (incomingContext: Context) => {
                    toolDescriptionsSeen.push(String(incomingContext.tools?.[0]?.description ?? ""));
                    return {
                        message: assistantMessageBuild([]),
                        providerId: "provider-1",
                        modelId: "model-1"
                    };
                })
        } as unknown as InferenceRouter;
        const toolResolver = {
            listTools: vi.fn(() => tools),
            listToolsForAgent: vi.fn(() => tools),
            execute: vi.fn(async (_toolCall, executeContext) => {
                toolResolverSkills.push(executeContext.skills);
                return toolResultTextBuild("call-1", "run_python", "ok");
            })
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                skills,
                rlm: true
            })
        );

        expect(skillsList).toHaveBeenCalledTimes(2);
        expect(syncToActive).toHaveBeenCalledTimes(2);
        expect(toolDescriptionsSeen).toHaveLength(2);
        expect(toolDescriptionsSeen[0]).toContain("Execute Python code to complete the task.");
        expect(toolDescriptionsSeen[1]).toContain("Execute Python code to complete the task.");
        expect(toolDescriptionsSeen[0]).not.toContain("alpha");
        expect(toolDescriptionsSeen[1]).not.toContain("beta");
        expect(toolResolverSkills).toHaveLength(1);
        expect(toolResolverSkills[0]).toEqual(firstSkills);
    });

    it("completes unfinished tool calls with abort records", async () => {
        const controller = new AbortController();
        const appended: string[] = [];
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                toolCallBuild("call-1", "run_python", { code: "print(1)" }),
                toolCallBuild("call-2", "read_file", { path: "notes.txt" })
            ])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            controller.abort();
            const error = new Error("aborted");
            error.name = "AbortError";
            throw error;
        });

        const result = await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                abortSignal: controller.signal,
                appendHistoryRecord: async (record) => {
                    appended.push(record.type);
                }
            })
        );

        const abortedResults = result.historyRecords.filter((record) => record.type === "tool_result");
        expect(abortedResults).toHaveLength(2);
        for (const record of abortedResults) {
            if (record.type !== "tool_result") {
                continue;
            }
            expect(record.output.toolMessage.isError).toBe(true);
            expect(record.output.toolMessage.content).toEqual([
                { type: "text", text: "User aborted before tool completion." }
            ]);
        }
        expect(appended).toEqual(["assistant_message", "tool_result", "tool_result"]);
    });

    it("passes appendHistoryRecord through tool execution context", async () => {
        const appendHistoryRecord = vi.fn(async () => undefined);
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([toolCallBuild("call-1", "read_file", { path: "x" })]),
            assistantMessageBuild([])
        ]);
        const execute = vi.fn(async () => toolResultTextBuild("call-1", "read_file", "ok"));
        const toolResolver = {
            listTools: () => [],
            listToolsForAgent: () => [],
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                appendHistoryRecord,
                rlm: true
            })
        );

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ appendHistoryRecord, rlmToolOnly: true })
        );
    });

    it("uses persisted inference session id for inference calls", async () => {
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi.fn(async () => ({
                message: assistantMessageBuild([]),
                providerId: "provider-1",
                modelId: "model-1"
            }))
        } as unknown as InferenceRouter;
        const toolResolver = toolResolverBuild(async () => toolResultTextBuild("call-1", "noop", "ok"));

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                inferenceSessionId: "session-abc"
            })
        );

        expect(inferenceRouter.complete).toHaveBeenCalledTimes(1);
        expect(inferenceRouter.complete).toHaveBeenCalledWith(expect.anything(), "session-abc", expect.anything());
    });

    it("executes run_python tags and injects python_result user messages in noTools mode", async () => {
        const appendHistoryTypes: string[] = [];
        const contexts: Context[] = [];
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi.fn(async (incomingContext: Context) => {
                contexts.push(structuredClone(incomingContext));
                if (contexts.length === 1) {
                    return {
                        message: assistantMessageBuild([
                            { type: "text", text: "<run_python>value = echo()\nvalue</run_python>" }
                        ]),
                        providerId: "provider-1",
                        modelId: "model-1"
                    };
                }
                return {
                    message: assistantMessageBuild([{ type: "text", text: "done" }]),
                    providerId: "provider-1",
                    modelId: "model-1"
                };
            })
        } as unknown as InferenceRouter;
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            if (toolCall.name !== "echo") {
                throw new Error(`Unexpected tool: ${toolCall.name}`);
            }
            return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                noTools: true,
                rlm: true,
                say: true,
                appendHistoryRecord: async (record) => {
                    appendHistoryTypes.push(record.type);
                }
            })
        );

        expect(inferenceRouter.complete).toHaveBeenCalledTimes(2);
        expect(inferenceRouter.complete).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.any(String),
            expect.objectContaining({
                providerOptions: {
                    stop: ["</run_python>"]
                }
            })
        );
        expect(contexts[0]?.tools).toEqual([]);
        expect(execute).toHaveBeenCalledTimes(1);
        const secondIterationMessages = contexts[1]?.messages ?? [];
        const hasPythonResultMessage = secondIterationMessages.some((message) => {
            if (message.role !== "user" || !Array.isArray(message.content)) {
                return false;
            }
            return message.content.some(
                (part) =>
                    part.type === "text" &&
                    typeof part.text === "string" &&
                    part.text.includes("<python_result>") &&
                    part.text.includes("Python execution completed.")
            );
        });
        expect(hasPythonResultMessage).toBe(true);
        expect(appendHistoryTypes).toContain("rlm_start");
        expect(appendHistoryTypes).toContain("rlm_tool_call");
        expect(appendHistoryTypes).toContain("rlm_tool_result");
        expect(appendHistoryTypes).toContain("rlm_complete");
    });

    it("trims inline run_python output at the first closing tag before execution", async () => {
        const contexts: Context[] = [];
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = {
            complete: vi.fn(async (incomingContext: Context) => {
                contexts.push(structuredClone(incomingContext));
                if (contexts.length === 1) {
                    return {
                        message: assistantMessageBuild([
                            {
                                type: "text",
                                text: [
                                    "<run_python>echo()</run_python>",
                                    "<run_python>fail()</run_python>",
                                    "<run_python>tail()</run_python>"
                                ].join("")
                            }
                        ]),
                        providerId: "provider-1",
                        modelId: "model-1"
                    };
                }
                return {
                    message: assistantMessageBuild([{ type: "text", text: "done" }]),
                    providerId: "provider-1",
                    modelId: "model-1"
                };
            })
        } as unknown as InferenceRouter;
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            if (toolCall.name === "echo") {
                return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
            }
            if (toolCall.name === "fail") {
                throw new Error("boom");
            }
            throw new Error(`Unexpected tool: ${toolCall.name}`);
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} },
                { name: "fail", description: "", parameters: {} },
                { name: "tail", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} },
                { name: "fail", description: "", parameters: {} },
                { name: "tail", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                noTools: true,
                rlm: true,
                say: true
            })
        );

        expect(inferenceRouter.complete).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: "echo" }), expect.anything());
        const assistantMessage = contexts[1]?.messages.find((message) => message.role === "assistant");
        const assistantText = assistantMessage ? (messageExtractText(assistantMessage) ?? "") : "";
        expect(assistantText).toContain("<run_python>echo()</run_python>");
        expect(assistantText).not.toContain("<run_python>fail()</run_python>");
        expect(assistantText).not.toContain("<run_python>tail()</run_python>");
        const secondIterationMessages = contexts[1]?.messages ?? [];
        const pythonResultTexts = secondIterationMessages
            .filter((message) => message.role === "user")
            .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
            .filter(
                (part): part is { type: "text"; text: string } =>
                    part.type === "text" && typeof part.text === "string" && part.text.includes("<python_result>")
            )
            .map((part) => part.text);
        expect(pythonResultTexts).toHaveLength(1);
        expect(pythonResultTexts[0]).toContain("Python execution completed.");
    });

    it("suppresses raw run_python text delivery in noTools mode", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "<run_python>echo()</run_python>" }]),
            assistantMessageBuild([])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                noTools: true,
                rlm: true,
                say: true
            })
        );

        expect(execute).toHaveBeenCalledTimes(1);
        expect(connectorSend).not.toHaveBeenCalled();
    });

    it("stores assistant history already trimmed at the first run_python closing tag", async () => {
        const appendedRecords: AgentHistoryRecord[] = [];
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                {
                    type: "text",
                    text: [
                        "<say>before</say>",
                        "<run_python>echo()</run_python>",
                        "<run_python>fail()</run_python>",
                        "<run_python>tail()</run_python>",
                        "<say>after</say>"
                    ].join("")
                }
            ]),
            assistantMessageBuild([])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            if (toolCall.name === "echo") {
                return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
            }
            throw new Error(`Unexpected tool: ${toolCall.name}`);
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} },
                { name: "fail", description: "", parameters: {} },
                { name: "tail", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} },
                { name: "fail", description: "", parameters: {} },
                { name: "tail", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                noTools: true,
                rlm: true,
                say: true,
                appendHistoryRecord: async (record) => {
                    appendedRecords.push(record);
                }
            })
        );

        const assistant = appendedRecords.find((record) => record.type === "assistant_message");
        if (!assistant || assistant.type !== "assistant_message") {
            throw new Error("Expected assistant history record.");
        }
        expect(assistant.text).toBe("<say>before</say><run_python>echo()</run_python>");
        expect(execute).toHaveBeenCalledTimes(1);

        const rewrites = appendedRecords.filter(
            (record): record is Extract<AgentHistoryRecord, { type: "assistant_rewrite" }> =>
                record.type === "assistant_rewrite"
        );
        expect(rewrites).toHaveLength(0);
    });

    it("breaks inference loop when skip tool is called directly", async () => {
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([toolCallBuild("call-1", "skip", {})]),
            assistantMessageBuild([{ type: "text", text: "should not reach" }])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "Turn skipped");
        });
        const toolResolver = {
            listTools: () => [],
            listToolsForAgent: () => [],
            execute
        } as unknown as ToolResolverApi;

        const result = await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        // Inference should be called only once (no second inference after skip)
        expect(inferenceRouter.complete).toHaveBeenCalledTimes(1);
        // Tool should be executed once
        expect(execute).toHaveBeenCalledTimes(1);
        // Context should have a "Turn skipped" user message at the end
        const lastMessage = context.messages[context.messages.length - 1];
        expect(lastMessage?.role).toBe("user");
        const textContent = Array.isArray(lastMessage?.content)
            ? lastMessage.content.find(
                  (part: { type: string; text?: string }) => part.type === "text" && part.text === "Turn skipped"
              )
            : undefined;
        expect(textContent).toBeDefined();
        expect(result.historyRecords).toBeDefined();
    });

    it("cancels remaining tool calls when skip is among multiple tool calls", async () => {
        const connector = connectorBuild(vi.fn(async () => undefined));
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                toolCallBuild("call-1", "skip", {}),
                toolCallBuild("call-2", "read_file", { path: "notes.txt" })
            ]),
            assistantMessageBuild([{ type: "text", text: "should not reach" }])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "Turn skipped");
        });
        const toolResolver = {
            listTools: () => [],
            listToolsForAgent: () => [],
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        // Only skip should be executed, read_file should be cancelled
        expect(execute).toHaveBeenCalledTimes(1);
        expect(inferenceRouter.complete).toHaveBeenCalledTimes(1);
    });

    it("does not execute run_python tags unless noTools, rlm, and say are all enabled", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "<run_python>echo()</run_python>" }])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                noTools: true,
                rlm: true,
                say: false
            })
        );

        expect(execute).not.toHaveBeenCalled();
        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "<run_python>echo()</run_python>",
            replyToMessageId: undefined
        });
    });

    it("blocks non-whitelisted tool execution for memory-agent descriptors", async () => {
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([toolCallBuild("call-1", "read_file", { path: "notes.txt" })]),
            assistantMessageBuild([])
        ]);
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: {
                schema: Type.Object({ text: Type.String() }, { additionalProperties: false }),
                toLLMText: (result: { text: string }) => result.text
            },
            execute: async () => toolResultTextBuild("call-1", "read_file", "ok")
        });

        const result = await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector: connectorBuild(vi.fn(async () => undefined)),
                inferenceRouter,
                toolResolver: resolver,
                agentType: "memory-agent"
            })
        );

        const blockedToolResult = result.historyRecords.find(
            (record): record is Extract<AgentHistoryRecord, { type: "tool_result" }> =>
                record.type === "tool_result" && record.toolCallId === "call-1"
        );

        expect(blockedToolResult?.output.toolMessage.isError).toBe(true);
        expect(blockedToolResult?.output.toolMessage.content).toEqual([
            { type: "text", text: 'Tool "read_file" is not allowed for this agent.' }
        ]);
    });
});

describe("agentLoopRun say tag", () => {
    it("sends only say block content when say feature enabled", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "thinking... <say>hello user</say> done" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver, say: true }));

        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "hello user",
            replyToMessageId: undefined
        });
    });

    it("does not fall back to raw text when say send fails", async () => {
        const connectorSend = vi.fn(async () => {
            throw new Error("send failed");
        });
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "thinking... <say>hello user</say> done" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver, say: true }));

        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "hello user",
            replyToMessageId: undefined
        });
    });

    it("sends multiple say blocks as separate messages", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "reasoning <say>first</say> more <say>second</say> end" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver, say: true }));

        expect(connectorSend).toHaveBeenCalledTimes(2);
        expect(connectorSend).toHaveBeenNthCalledWith(1, "channel-1", {
            text: "first",
            replyToMessageId: undefined
        });
        expect(connectorSend).toHaveBeenNthCalledWith(2, "channel-1", {
            text: "second",
            replyToMessageId: undefined
        });
    });

    it("suppresses output when say enabled but no say tags present", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "just thinking, no say tags" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver, say: true }));

        expect(connectorSend).not.toHaveBeenCalled();
    });

    it("does not apply say filtering for background agents", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        // Background agent with <say> tags — say feature should not activate
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "thinking <say>hi</say> done" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        const result = await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                say: true,
                agentType: "subagent"
            })
        );

        // Background agents have no target (agentDescriptorTargetResolve returns null).
        // responseText is the full unfiltered text (say not applied to background agents).
        expect(result.responseText).toBe("thinking <say>hi</say> done");
    });

    it("sends full text when say feature disabled", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([{ type: "text", text: "thinking <say>hi</say> more" }])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        await agentLoopRun(optionsBuild({ entry, context, connector, inferenceRouter, toolResolver, say: false }));

        // Full text sent, say tags are just text
        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledWith("channel-1", {
            text: "thinking <say>hi</say> more",
            replyToMessageId: undefined
        });
    });

    it("processes say tags before run_python execution when noTools is enabled", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                {
                    type: "text",
                    text: "thinking <say>working</say> <run_python>echo()</run_python>"
                }
            ]),
            assistantMessageBuild([{ type: "text", text: "<say>done</say>" }])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                say: true,
                noTools: true,
                rlm: true
            })
        );

        expect(connectorSend).toHaveBeenNthCalledWith(1, "channel-1", {
            text: "working",
            replyToMessageId: undefined
        });
        expect(execute).toHaveBeenCalledTimes(1);
        const firstSendOrder = connectorSend.mock.invocationCallOrder[0];
        const firstExecuteOrder = execute.mock.invocationCallOrder[0];
        expect(firstSendOrder).toBeDefined();
        expect(firstExecuteOrder).toBeDefined();
        if (firstSendOrder === undefined || firstExecuteOrder === undefined) {
            throw new Error("Expected both send and execute calls to be recorded.");
        }
        expect(firstSendOrder).toBeLessThan(firstExecuteOrder);
    });

    it("ignores post-run_python <say> tags even when execution succeeds", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                {
                    type: "text",
                    text: "<say>before</say><run_python>echo()</run_python><say>after</say>"
                }
            ]),
            assistantMessageBuild([])
        ]);
        const execute = vi.fn(async (toolCall: { id: string; name: string }) => {
            return toolResultTextBuild(toolCall.id, toolCall.name, "ok");
        });
        const toolResolver = {
            listTools: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            listToolsForAgent: vi.fn(() => [
                { name: "run_python", description: "", parameters: {} },
                { name: "echo", description: "", parameters: {} }
            ]),
            execute
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                say: true,
                noTools: true,
                rlm: true
            })
        );

        expect(connectorSend).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenNthCalledWith(1, "channel-1", {
            text: "before",
            files: undefined,
            replyToMessageId: undefined
        });
        expect(execute).toHaveBeenCalledTimes(1);
        const beforeOrder = connectorSend.mock.invocationCallOrder[0];
        const executeOrder = execute.mock.invocationCallOrder[0];
        expect(beforeOrder).toBeDefined();
        expect(executeOrder).toBeDefined();
        if (beforeOrder === undefined || executeOrder === undefined) {
            throw new Error("Expected ordered send/execute calls to be recorded.");
        }
        expect(beforeOrder).toBeLessThan(executeOrder);
    });

    it("rewrites context history by removing post-run_python <say> without adding ignored notice", async () => {
        const connectorSend = vi.fn(async (_targetId: string, _message: unknown) => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const contexts: Context[] = [];
        const inferenceRouter = {
            complete: vi.fn(async (incomingContext: Context) => {
                contexts.push(structuredClone(incomingContext));
                if (contexts.length === 1) {
                    return {
                        message: assistantMessageBuild([
                            {
                                type: "text",
                                text: "<say>before</say><run_python>def broken(</run_python><say>after</say>"
                            }
                        ]),
                        providerId: "provider-1",
                        modelId: "model-1"
                    };
                }
                return {
                    message: assistantMessageBuild([{ type: "text", text: "<say>next</say>" }]),
                    providerId: "provider-1",
                    modelId: "model-1"
                };
            })
        } as unknown as InferenceRouter;
        const toolResolver = {
            listTools: vi.fn(() => [{ name: "run_python", description: "", parameters: {} }]),
            listToolsForAgent: vi.fn(() => [{ name: "run_python", description: "", parameters: {} }]),
            execute: vi.fn(async () => {
                throw new Error("unexpected");
            })
        } as unknown as ToolResolverApi;

        await agentLoopRun(
            optionsBuild({
                entry,
                context,
                connector,
                inferenceRouter,
                toolResolver,
                say: true,
                noTools: true,
                rlm: true
            })
        );

        expect(contexts).toHaveLength(2);
        const assistantMessage = contexts[1]?.messages.find((message) => message.role === "assistant");
        const assistantText = assistantMessage ? (messageExtractText(assistantMessage) ?? "") : "";
        expect(assistantText).toContain("<say>before</say>");
        expect(assistantText).toContain("</run_python>");
        expect(assistantText).not.toContain("<say>after</say>");

        const pythonResultTexts = (contexts[1]?.messages ?? [])
            .filter((message) => message.role === "user")
            .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
            .filter(
                (part): part is { type: "text"; text: string } =>
                    part.type === "text" && typeof part.text === "string" && part.text.includes("<python_result>")
            )
            .map((part) => part.text);
        expect(pythonResultTexts).toHaveLength(1);
        expect(pythonResultTexts[0]).toContain("Python syntax error. Fix the code and retry.");

        const hasPythonResultMessage = (contexts[1]?.messages ?? []).some((message) => {
            if (message.role !== "user" || !Array.isArray(message.content)) {
                return false;
            }
            return message.content.some(
                (part) => part.type === "text" && typeof part.text === "string" && part.text.includes("<python_result>")
            );
        });
        expect(hasPythonResultMessage).toBe(true);

        const sentTexts = connectorSend.mock.calls.map((call) => {
            const message = call[1] as { text?: string | null };
            return message.text ?? null;
        });
        expect(sentTexts).toEqual(["before", "next"]);
    });

    it("attaches <file> tags to the final <say> block", async () => {
        const tmpDir = await fs.mkdtemp("/tmp/daycare-file-tag-");
        const reportPath = path.join(tmpDir, "file-1__report.pdf");
        await fs.writeFile(reportPath, "report");
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                {
                    type: "text",
                    text: ["<say>first</say>", "<say>second</say>", `<file mode="doc">${reportPath}</file>`].join("")
                }
            ])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        try {
            await agentLoopRun(
                optionsBuild({
                    entry,
                    context,
                    connector,
                    inferenceRouter,
                    toolResolver,
                    say: true
                })
            );

            expect(connectorSend).toHaveBeenCalledTimes(2);
            expect(connectorSend).toHaveBeenNthCalledWith(1, "channel-1", {
                text: "first",
                files: undefined,
                replyToMessageId: undefined
            });
            expect(connectorSend).toHaveBeenNthCalledWith(2, "channel-1", {
                text: "second",
                files: [
                    {
                        id: "~/downloads/file-1__report.pdf",
                        name: "file-1__report.pdf",
                        mimeType: "application/pdf",
                        size: 6,
                        path: "/tmp/downloads/file-1__report.pdf",
                        sendAs: "document"
                    }
                ],
                replyToMessageId: undefined
            });
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("sends files with null text when only <file> tags exist in say mode", async () => {
        const tmpDir = await fs.mkdtemp("/tmp/daycare-file-tag-");
        const reportPath = path.join(tmpDir, "file-1__report.pdf");
        await fs.writeFile(reportPath, "report");
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const entry = entryBuild();
        const context = contextBuild();
        const inferenceRouter = inferenceRouterBuild([
            assistantMessageBuild([
                {
                    type: "text",
                    text: `thinking... <file>${reportPath}</file>`
                }
            ])
        ]);
        const toolResolver = toolResolverBuild(async () => {
            throw new Error("unexpected");
        });

        try {
            await agentLoopRun(
                optionsBuild({
                    entry,
                    context,
                    connector,
                    inferenceRouter,
                    toolResolver,
                    say: true
                })
            );

            expect(connectorSend).toHaveBeenCalledTimes(1);
            expect(connectorSend).toHaveBeenCalledWith("channel-1", {
                text: null,
                files: [
                    {
                        id: "~/downloads/file-1__report.pdf",
                        name: "file-1__report.pdf",
                        mimeType: "application/pdf",
                        size: 6,
                        path: "/tmp/downloads/file-1__report.pdf",
                        sendAs: "auto"
                    }
                ],
                replyToMessageId: undefined
            });
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });
});

function optionsBuild(params: {
    entry: AgentMessage;
    context: Context;
    connector: Connector;
    inferenceRouter: InferenceRouter;
    toolResolver: ToolResolverApi;
    skills?: Skills;
    rlm?: boolean;
    say?: boolean;
    noTools?: boolean;
    agentType?: "user" | "subagent" | "memory-agent";
    abortSignal?: AbortSignal;
    appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>;
    inferenceSessionId?: string;
}) {
    const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    };
    const connectorRegistry = connectorRegistryBuild();
    const skills =
        params.skills ??
        ({
            list: vi.fn(async (): Promise<AgentSkill[]> => []),
            syncToActive: vi.fn(async () => undefined)
        } as unknown as Skills);
    const descriptor =
        params.agentType === "subagent"
            ? {
                  type: "subagent",
                  id: "subagent-1",
                  parentAgentId: "agent-parent",
                  name: "child"
              }
            : params.agentType === "memory-agent"
              ? {
                    type: "memory-agent",
                    id: "source-agent-1"
                }
              : {
                    type: "user",
                    connector: "telegram",
                    channelId: "channel-1",
                    userId: "user-1"
                };
    return {
        entry: params.entry,
        agent: {
            id: "agent-1",
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            userId: "user-1",
            descriptor,
            inbox: {
                hasSteering: () => false,
                consumeSteering: () => null
            },
            state: {
                inferenceSessionId: params.inferenceSessionId ?? "session-agent-1",
                permissions: {
                    workingDir: "/tmp",
                    writeDirs: ["/tmp"]
                }
            },
            sandbox: {
                homeDir: "/tmp",
                workingDir: "/tmp",
                permissions: {
                    workingDir: "/tmp",
                    writeDirs: ["/tmp"]
                },
                write: vi.fn(async (args: { path: string; content: string | Buffer }) => ({
                    bytes: Buffer.isBuffer(args.content) ? args.content.byteLength : Buffer.byteLength(args.content),
                    resolvedPath: args.path,
                    sandboxPath: `~/${path.relative("/tmp", args.path)}`
                }))
            }
        } as unknown as Agent,
        source: "telegram",
        context: params.context,
        connector: params.connector,
        connectorRegistry,
        inferenceRouter: params.inferenceRouter,
        toolResolver: params.toolResolver,
        authStore: {} as AuthStore,
        eventBus: { emit: vi.fn() } as unknown as EngineEventBus,
        assistant: null,
        agentSystem: {
            config: {
                current: {
                    features: {
                        rlm: params.rlm ?? false,
                        say: params.say ?? false,
                        noTools: params.noTools ?? false
                    }
                }
            },
            imageRegistry: { list: () => [] }
        } as unknown as AgentSystem,
        heartbeats: {} as Heartbeats,
        memory: {} as Memory,
        skills,
        skillsActiveRoot: "/tmp/skills/active",
        providersForAgent: [],
        verbose: false,
        logger: logger as never,
        abortSignal: params.abortSignal,
        appendHistoryRecord: params.appendHistoryRecord,
        notifySubagentFailure: vi.fn(async () => undefined)
    };
}

function connectorBuild(send: (targetId: string, message: unknown) => Promise<void>): Connector {
    return {
        capabilities: {
            sendText: true,
            sendFiles: { modes: ["photo"] }
        },
        onMessage: () => () => undefined,
        sendMessage: send,
        startTyping: () => () => undefined
    };
}

function contextBuild(): Context {
    return {
        messages: [],
        tools: []
    };
}

function entryBuild(): AgentMessage {
    return {
        id: "message-1",
        message: { text: "generate", files: [] },
        context: {},
        receivedAt: Date.now()
    };
}

function inferenceRouterBuild(messages: AssistantMessage[]): InferenceRouter {
    return {
        complete: vi.fn(async () => {
            const message = messages.shift();
            if (!message) {
                throw new Error("No inference response prepared");
            }
            return {
                message,
                providerId: "provider-1",
                modelId: "model-1"
            };
        })
    } as unknown as InferenceRouter;
}

function toolResolverBuild(
    execute: (toolCall: { id: string; name: string }) => Promise<ToolExecutionResult>
): ToolResolverApi {
    return {
        listTools: () => [],
        listToolsForAgent: () => [],
        execute: vi.fn(async (toolCall: { id: string; name: string }) => execute(toolCall))
    } as unknown as ToolResolverApi;
}

function connectorRegistryBuild(): ConnectorRegistry {
    return {
        get: () => ({ capabilities: { sendFiles: { modes: ["photo"] }, reactions: false } }),
        list: () => ["telegram"]
    } as unknown as ConnectorRegistry;
}

function assistantMessageBuild(
    content: AssistantMessage["content"],
    options?: {
        stopReason?: AssistantMessage["stopReason"];
        errorMessage?: string;
    }
): AssistantMessage {
    return {
        role: "assistant",
        content,
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
        stopReason: options?.stopReason ?? "stop",
        errorMessage: options?.errorMessage,
        timestamp: Date.now()
    };
}

function toolCallBuild(id: string, name: string, argumentsValue: Record<string, unknown>): ToolCall {
    return {
        id,
        name,
        type: "toolCall",
        arguments: argumentsValue
    };
}

function toolResultGeneratedBuild(workspacePath: string, toolCallId: string, toolName: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId,
            toolName,
            content: [{ type: "text", text: "generated" }],
            details: {
                workspace: {
                    files: [{ path: workspacePath }]
                }
            },
            isError: false,
            timestamp: Date.now()
        },
        typedResult: { text: "generated" }
    };
}

function toolResultTextBuild(toolCallId: string, toolName: string, text: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId,
            toolName,
            content: [{ type: "text", text }],
            isError: false,
            timestamp: Date.now()
        },
        typedResult: { text }
    };
}
