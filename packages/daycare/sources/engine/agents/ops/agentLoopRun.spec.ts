import type { AssistantMessage, Context, Tool } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentDescriptor, Connector, ToolExecutionResult } from "@/types";
import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import { contextForAgent } from "../context.js";
import { agentLoopRun } from "./agentLoopRun.js";
import type { AgentMessage } from "./agentTypes.js";

const { rlmExecuteMock } = vi.hoisted(() => ({
    rlmExecuteMock: vi.fn()
}));

vi.mock("../../modules/rlm/rlmExecute.js", () => ({
    rlmExecute: rlmExecuteMock
}));

describe("agentLoopRun", () => {
    beforeEach(() => {
        rlmExecuteMock.mockReset();
    });

    it("always requests inference with the run_python stop sequence", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const responses = [
            assistantMessageBuild("<run_python>echo('x')</run_python>"),
            assistantMessageBuild("<say>Done</say>")
        ];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();
        rlmExecuteMock.mockResolvedValue({
            output: "ok",
            printOutput: [],
            toolCallCount: 0
        });

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

    it("delivers say blocks and executes run_python blocks inline", async () => {
        const connectorSend = vi.fn(async () => undefined);
        const connector = connectorBuild(connectorSend);
        const responses = [
            assistantMessageBuild("<say>Starting</say><run_python>echo('x')</run_python>"),
            assistantMessageBuild("<say>Finished</say>")
        ];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();
        rlmExecuteMock.mockResolvedValue({
            output: "ok",
            printOutput: [],
            toolCallCount: 0
        });

        await agentLoopRun(
            optionsBuild({
                connector,
                inferenceRouter,
                toolResolver
            })
        );

        expect(rlmExecuteMock).toHaveBeenCalledTimes(1);
        expect(connectorSend).toHaveBeenCalledTimes(2);
        expect(connectorSend).toHaveBeenNthCalledWith(1, "channel-1", expect.objectContaining({ text: "Starting" }));
        expect(connectorSend).toHaveBeenNthCalledWith(2, "channel-1", expect.objectContaining({ text: "Finished" }));
    });

    it("nudges child agents when no send_agent_message call was made", async () => {
        const responses = [assistantMessageBuild("No execution"), assistantMessageBuild("Still no execution")];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild();
        rlmExecuteMock.mockReset();

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
        const responses = [assistantMessageBuild("<run_python>deliver()</run_python>"), assistantMessageBuild("Done")];
        const inferenceRouter = inferenceRouterBuild(responses);
        const toolResolver = toolResolverBuild(async (toolCall) => toolResultBuild(toolCall.id, toolCall.name, "sent"));
        rlmExecuteMock.mockImplementation(
            async (_code: string, _preamble: string, context: unknown, runtimeToolResolver: ToolResolverApi) => {
                await runtimeToolResolver.execute(
                    {
                        type: "toolCall",
                        id: "tool-call-send",
                        name: "send_agent_message",
                        arguments: { text: "payload for parent" }
                    },
                    context as Parameters<ToolResolverApi["execute"]>[1]
                );
                return {
                    output: "ok",
                    printOutput: [],
                    toolCallCount: 1
                };
            }
        );

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
    const inferenceRouter = params?.inferenceRouter ?? inferenceRouterBuild([assistantMessageBuild("<say>ok</say>")]);
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
        { name: "send_agent_message", description: "Send message to parent", parameters: {} },
        { name: "echo", description: "Echo", parameters: {} }
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
