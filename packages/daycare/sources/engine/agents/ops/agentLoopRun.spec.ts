import type { AssistantMessage, Context, Tool, ToolCall } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { agentLoopRun } from "./agentLoopRun.js";
import type { AgentHistoryRecord, AgentMessage } from "./agentTypes.js";
import type { Agent } from "../agent.js";
import type { Connector, FileReference, ToolExecutionResult } from "@/types";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import type { AgentSkill } from "@/types";
import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { FileStore } from "../../../files/store.js";
import type { AuthStore } from "../../../auth/store.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { AgentSystem } from "../agentSystem.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { Skills } from "../../skills/skills.js";

describe("agentLoopRun", () => {
  it("auto-sends generated files without fallback text when model has no final text", async () => {
    const generatedFile: FileReference = {
      id: "generated-file-1",
      name: "image.png",
      mimeType: "image/png",
      size: 16,
      path: "/tmp/provider/image.png"
    };
    const connectorSend = vi.fn(
      async (_targetId: string, _message: unknown) => undefined
    );
    const connector = connectorBuild(connectorSend);
    const entry = entryBuild();
    const context = contextBuild();
    const inferenceRouter = inferenceRouterBuild([
      assistantMessageBuild([
        toolCallBuild("call-1", "generate_image", { prompt: "draw cat" })
      ]),
      assistantMessageBuild([])
    ]);

    const toolResolver = toolResolverBuild(async (toolCall) => {
      if (toolCall.name !== "generate_image") {
        throw new Error(`Unexpected tool: ${toolCall.name}`);
      }
      return toolResultGeneratedBuild(
        generatedFile,
        "/workspace/files/generated-image.png",
        toolCall.id,
        toolCall.name
      );
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

    expect(connectorSend).toHaveBeenCalledTimes(1);
    expect(connectorSend).toHaveBeenCalledWith(
      "channel-1",
      expect.objectContaining({
        text: null,
        files: [generatedFile]
      })
    );
  });

  it("reads skills via facade before each inference call", async () => {
    const firstSkills: AgentSkill[] = [
      {
        id: "config:alpha",
        name: "alpha",
        description: "first",
        path: "/tmp/alpha/SKILL.md",
        source: "config"
      }
    ];
    const secondSkills: AgentSkill[] = [
      {
        id: "config:beta",
        name: "beta",
        description: "second",
        path: "/tmp/beta/SKILL.md",
        source: "config"
      }
    ];
    const skillsList = vi
      .fn(async (): Promise<AgentSkill[]> => firstSkills)
      .mockResolvedValueOnce(firstSkills)
      .mockResolvedValueOnce(secondSkills);
    const skills = { list: skillsList } as unknown as Skills;
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
            message: assistantMessageBuild([
              toolCallBuild("call-1", "run_python", { code: "print(1)" })
            ]),
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
    expect(toolDescriptionsSeen).toHaveLength(2);
    expect(toolDescriptionsSeen[0]).toContain("alpha");
    expect(toolDescriptionsSeen[1]).toContain("beta");
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
    expect(inferenceRouter.complete).toHaveBeenCalledWith(
      expect.anything(),
      "session-abc",
      expect.anything()
    );
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
      list: vi.fn(async (): Promise<AgentSkill[]> => [])
    } as unknown as Skills);
  return {
    entry: params.entry,
    agent: {
      id: "agent-1",
      descriptor: {
        type: "user",
        connector: "telegram",
        channelId: "channel-1",
        userId: "user-1"
      },
      state: {
        inferenceSessionId: params.inferenceSessionId ?? "session-agent-1",
        permissions: {
          workingDir: "/workspace",
          writeDirs: ["/workspace"],
          readDirs: ["/workspace"],
          network: false,
          events: false
        }
      }
    } as unknown as Agent,
    source: "telegram",
    context: params.context,
    connector: params.connector,
    connectorRegistry,
    inferenceRouter: params.inferenceRouter,
    toolResolver: params.toolResolver,
    fileStore: {} as FileStore,
    authStore: {} as AuthStore,
    eventBus: { emit: vi.fn() } as unknown as EngineEventBus,
    assistant: null,
    agentSystem: {
      config: { current: { features: { rlm: params.rlm ?? false, say: false } } },
      imageRegistry: { list: () => [] }
    } as unknown as AgentSystem,
    heartbeats: {} as Heartbeats,
    skills,
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
    execute: vi.fn(async (toolCall: { id: string; name: string }) => execute(toolCall))
  } as unknown as ToolResolverApi;
}

function connectorRegistryBuild(): ConnectorRegistry {
  return {
    get: () => ({ capabilities: { sendFiles: { modes: ["photo"] }, reactions: false } }),
    list: () => ["telegram"]
  } as unknown as ConnectorRegistry;
}

function assistantMessageBuild(content: AssistantMessage["content"]): AssistantMessage {
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
    stopReason: "stop",
    timestamp: Date.now()
  };
}

function toolCallBuild(
  id: string,
  name: string,
  argumentsValue: Record<string, unknown>
): ToolCall {
  return {
    id,
    name,
    type: "toolCall",
    arguments: argumentsValue
  };
}

function toolResultGeneratedBuild(
  file: FileReference,
  workspacePath: string,
  toolCallId: string,
  toolName: string
): ToolExecutionResult {
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
    files: [file]
  };
}

function toolResultTextBuild(
  toolCallId: string,
  toolName: string,
  text: string
): ToolExecutionResult {
  return {
    toolMessage: {
      role: "toolResult",
      toolCallId,
      toolName,
      content: [{ type: "text", text }],
      isError: false,
      timestamp: Date.now()
    },
    files: []
  };
}
