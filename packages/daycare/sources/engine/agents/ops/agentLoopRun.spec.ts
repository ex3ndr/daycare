import type { AssistantMessage, Context, Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type { AgentDescriptor, Connector, ToolExecutionResult } from "@/types";
import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import { contextForAgent } from "../context.js";
import { agentLoopRun } from "./agentLoopRun.js";
import type { AgentMessage } from "./agentTypes.js";

describe("agentLoopRun", () => {
    it("always requests inference with the run_python stop sequence", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const responses = [assistantMessageBuild("<run_python>echo('x')</run_python>"), assistantMessageBuild("Done")];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();

        await agentLoopRun(
            optionsBuild({
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        expect(inferenceRouter.complete).toHaveBeenCalled();
        expect(inferenceRouter.complete).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            "agent-1",
            expect.objectContaining({
                providerOptions: {
                    stop: ["</run_python>"]
                }
            })
        );
    });

    it("forwards plain assistant text and executes run_python blocks inline", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const responses = [
            assistantMessageBuild("Preparing execution...\n<run_python>echo('x')</run_python>"),
            assistantMessageBuild("Finished")
        ];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();

        await agentLoopRun(
            optionsBuild({
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        expect(connectorSend).toHaveBeenCalledTimes(2);
        expect(connectorSend).toHaveBeenNthCalledWith(
            1,
            "channel-1",
            expect.objectContaining({ text: "Preparing execution...\n" })
        );
        expect(connectorSend).toHaveBeenNthCalledWith(2, "channel-1", expect.objectContaining({ text: "Finished" }));
    });

    it("nudges child agents when no send_agent_message call was made", async () => {
        const responses = [assistantMessageBuild("No execution"), assistantMessageBuild("Still no execution")];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();

        await agentLoopRun(
            optionsBuild({
                descriptor: { type: "subagent", id: "child-1", parentAgentId: "parent-1", name: "child" },
                source: "subagent",
                connector: null,
                inferenceRouter,
                toolResolver
            })
        );

        expect(inferenceRouter.complete).toHaveBeenCalledTimes(2);
        const secondContext = inferenceRouter.complete.mock.calls[1]?.[0];
        expect(JSON.stringify(secondContext ?? {})).toContain("Use the send_agent_message tool");
    });

    it("tracks send_agent_message during inline python execution for child agents", async () => {
        const responses = [
            assistantMessageBuild("<run_python>send_agent_message(text='payload for parent')</run_python>"),
            assistantMessageBuild("Done")
        ];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild(async (toolCall) => toolResultBuild(toolCall.id, toolCall.name, "sent"));

        const result = await agentLoopRun(
            optionsBuild({
                descriptor: { type: "subagent", id: "child-1", parentAgentId: "parent-1", name: "child" },
                source: "subagent",
                connector: null,
                inferenceRouter,
                toolResolver
            })
        );

        expect(result.responseText).toBe("payload for parent");
    });

    it("stops immediately when run_python tool execution aborts", async () => {
        const responses = [assistantMessageBuild("<run_python>echo('x')</run_python>")];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild(async () => {
            throw abortErrorBuild();
        });
        const options = optionsBuild({
            inferenceRouter,
            toolResolver
        });
        const notifySubagentFailure = vi.fn(async () => undefined);
        options.notifySubagentFailure = notifySubagentFailure;

        const result = await agentLoopRun(options);

        expect(inferenceRouter.complete).toHaveBeenCalledTimes(1);
        expect(notifySubagentFailure).not.toHaveBeenCalled();
        expect(result.responseText).toBeNull();
    });

    it("completes run_python when a listed tool disappears before dispatch", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const responses = [
            assistantMessageBuild(
                "<run_python>try:\n    transient_tool()\nexcept ToolError as e:\n    print(e)\n'done'</run_python>"
            ),
            assistantMessageBuild("Finished")
        ];
        const inferenceRouter = inferenceRouterBuild(responses);
        const baseTools = toolResolverBuild().listToolsForAgent({
            ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
            descriptor: {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            }
        });
        const toolsWithTransient = [
            ...baseTools,
            {
                name: "transient_tool",
                description: "May disappear",
                parameters: Type.Object({}, { additionalProperties: false })
            }
        ] as unknown as Tool[];
        const execute = vi.fn(async (toolCall) => toolResultBuild(toolCall.id, toolCall.name, "unexpected"));
        let listToolsForAgentCalls = 0;
        const toolResolver: ToolResolverApi = {
            listTools: () => toolsWithTransient,
            listToolsForAgent: () => {
                listToolsForAgentCalls += 1;
                return listToolsForAgentCalls <= 3 ? toolsWithTransient : baseTools;
            },
            execute
        };
        let sawNonErrorComplete = false;
        const appendHistoryRecord = vi.fn(async (record: { type: string; isError?: boolean }) => {
            if (record.type === "rlm_complete" && record.isError === false) {
                sawNonErrorComplete = true;
            }
        });
        const options = optionsBuild({
            connector,
            inferenceRouter,
            toolResolver
        });
        options.appendHistoryRecord = appendHistoryRecord;

        await agentLoopRun(options);

        expect(sawNonErrorComplete).toBe(true);
        expect(execute).not.toHaveBeenCalled();
        expect(connectorSend).toHaveBeenCalledWith("channel-1", expect.objectContaining({ text: "Finished" }));
    });

    it("emits token stats updates with cost from usage", async () => {
        const response = assistantMessageBuild("Done");
        response.usage = {
            input: 12,
            output: 4,
            cacheRead: 3,
            cacheWrite: 2,
            totalTokens: 21,
            cost: {
                input: 0.01,
                output: 0.02,
                cacheRead: 0.005,
                cacheWrite: 0.004,
                total: 0.039
            }
        };
        response.timestamp = 1234567890;
        const inferenceRouter = inferenceRouterBuild([response]);

        const result = await agentLoopRun(
            optionsBuild({
                connector: null,
                inferenceRouter
            })
        );

        expect(result.tokenStatsUpdates).toEqual([
            {
                at: 1234567890,
                provider: "openai",
                model: "gpt-test",
                size: {
                    input: 12,
                    output: 4,
                    cacheRead: 3,
                    cacheWrite: 2,
                    total: 21
                },
                cost: 0.039
            }
        ]);
    });
});

function optionsBuild(params?: {
    descriptor?: AgentDescriptor;
    source?: string;
    connector?: Connector | null;
    inferenceRouter?: InferenceRouter;
    toolResolver?: ToolResolverApi;
}) {
    const descriptor: AgentDescriptor = params?.descriptor ?? {
        type: "user",
        connector: "telegram",
        channelId: "channel-1",
        userId: "user-1"
    };
    const connector = params?.connector ?? connectorBuild(vi.fn(async () => undefined));
    const inferenceRouter = params?.inferenceRouter ?? inferenceRouterBuild([assistantMessageBuild("ok")]);
    const toolResolver =
        params?.toolResolver ??
        toolResolverBuild(async (toolCall) => toolResultBuild(toolCall.id, toolCall.name, "ok"));
    const ctx = contextForAgent({ userId: "user-1", agentId: "agent-1" });
    const entry: AgentMessage = {
        id: "message-1",
        receivedAt: Date.now(),
        context: {},
        message: {
            text: "hi",
            rawText: "hi",
            files: []
        }
    };
    const agent = {
        id: "agent-1",
        ctx,
        descriptor,
        state: {
            inferenceSessionId: "agent-1"
        },
        sandbox: {},
        inbox: {
            consumeSteering: () => null
        }
    } as unknown as Parameters<typeof agentLoopRun>[0]["agent"];

    return {
        entry,
        agent,
        source: params?.source ?? "telegram",
        context: { messages: [] } as Context,
        connector,
        connectorRegistry: {
            get: () => null,
            list: () => []
        } as unknown as Parameters<typeof agentLoopRun>[0]["connectorRegistry"],
        inferenceRouter,
        toolResolver,
        authStore: {} as Parameters<typeof agentLoopRun>[0]["authStore"],
        eventBus: { emit: () => undefined } as unknown as Parameters<typeof agentLoopRun>[0]["eventBus"],
        assistant: null,
        agentSystem: {
            config: { current: { settings: { assistant: null } } }
        } as unknown as Parameters<typeof agentLoopRun>[0]["agentSystem"],
        heartbeats: {} as Parameters<typeof agentLoopRun>[0]["heartbeats"],
        memory: {} as Parameters<typeof agentLoopRun>[0]["memory"],
        skills: {
            list: async () => [],
            syncToActive: async () => undefined
        } as unknown as Parameters<typeof agentLoopRun>[0]["skills"],
        providersForAgent: [],
        logger: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined
        } as unknown as Parameters<typeof agentLoopRun>[0]["logger"],
        notifySubagentFailure: async () => undefined
    } as Parameters<typeof agentLoopRun>[0];
}

function inferenceRouterBuild(messages: AssistantMessage[]): InferenceRouter & { complete: ReturnType<typeof vi.fn> } {
    let index = 0;
    const complete = vi.fn(async () => {
        const message = messages[index] ?? messages[messages.length - 1];
        index += 1;
        return {
            message: message ?? assistantMessageBuild(""),
            providerId: "openai",
            modelId: "gpt-test"
        };
    });
    return { complete } as unknown as InferenceRouter & { complete: ReturnType<typeof vi.fn> };
}

function connectorBuild(sendMessage: (targetId: string, message: unknown) => Promise<void>): Connector {
    return {
        capabilities: { sendText: true },
        onMessage: () => () => undefined,
        sendMessage
    };
}

function toolResolverBuild(
    execute?: (toolCall: { id: string; name: string }) => Promise<ToolExecutionResult>
): ToolResolverApi {
    const tools = [
        {
            name: "send_agent_message",
            description: "Send message to parent",
            parameters: Type.Object(
                {
                    agentId: Type.Optional(Type.String()),
                    text: Type.Optional(Type.String())
                },
                { additionalProperties: false }
            )
        },
        {
            name: "echo",
            description: "Echo",
            parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
        }
    ] as unknown as Tool[];

    return {
        listTools: () => tools,
        listToolsForAgent: () => tools,
        execute: vi.fn(async (toolCall) => {
            if (execute) {
                return execute(toolCall);
            }
            return toolResultBuild(toolCall.id, toolCall.name, "ok");
        })
    };
}

function toolResultBuild(toolCallId: string, toolName: string, text: string): ToolExecutionResult {
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

function assistantMessageBuild(text: string): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-test",
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

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
}
