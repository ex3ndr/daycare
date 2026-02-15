import type { AssistantMessage, Context, Tool, ToolCall } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { agentLoopRun } from "./agentLoopRun.js";
import type { AgentMessage } from "./agentTypes.js";
import type { Agent } from "../agent.js";
import type { AgentSkill, Connector, FileReference, ToolExecutionResult } from "@/types";
import type { ToolResolver } from "../../modules/toolResolver.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { FileStore } from "../../../files/store.js";
import type { AuthStore } from "../../../auth/store.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { AgentSystem } from "../agentSystem.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";

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

  it("refreshes skills and tool context on each inference iteration", async () => {
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
    const skillsLoad = vi
      .fn(async (): Promise<AgentSkill[]> => firstSkills)
      .mockResolvedValueOnce(firstSkills)
      .mockResolvedValueOnce(secondSkills);
    const toolsForSkillsBuild = vi.fn((skills: AgentSkill[]): Tool[] => [
      {
        name: "run_python",
        description: `skills=${skills.map((skill) => skill.name).join(",")}`,
        parameters: {} as Tool["parameters"]
      }
    ]);
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
              toolCallBuild("call-1", "skill", { name: "alpha" })
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
      execute: vi.fn(async (_toolCall, executeContext) => {
        toolResolverSkills.push(executeContext.skills);
        return toolResultTextBuild("call-1", "skill", "ok");
      })
    } as unknown as ToolResolver;

    await agentLoopRun(
      optionsBuild({
        entry,
        context,
        connector,
        inferenceRouter,
        toolResolver,
        skillsLoad,
        toolsForSkillsBuild
      })
    );

    expect(skillsLoad).toHaveBeenCalledTimes(2);
    expect(toolsForSkillsBuild).toHaveBeenCalledTimes(2);
    expect(toolDescriptionsSeen).toEqual(["skills=alpha", "skills=beta"]);
    expect(toolResolverSkills).toHaveLength(1);
    expect(toolResolverSkills[0]).toEqual(firstSkills);
  });
});

function optionsBuild(params: {
  entry: AgentMessage;
  context: Context;
  connector: Connector;
  inferenceRouter: InferenceRouter;
  toolResolver: ToolResolver;
  skillsLoad?: () => Promise<AgentSkill[]>;
  toolsForSkillsBuild?: (skills: AgentSkill[]) => Tool[];
}) {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
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
    connectorRegistry: {} as ConnectorRegistry,
    inferenceRouter: params.inferenceRouter,
    toolResolver: params.toolResolver,
    fileStore: {} as FileStore,
    authStore: {} as AuthStore,
    eventBus: { emit: vi.fn() } as unknown as EngineEventBus,
    assistant: null,
    agentSystem: {} as AgentSystem,
    heartbeats: {} as Heartbeats,
    skills: [],
    skillsLoad: params.skillsLoad,
    toolsForSkillsBuild: params.toolsForSkillsBuild,
    providersForAgent: [],
    verbose: false,
    logger: logger as never,
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
): ToolResolver {
  return {
    execute: vi.fn(async (toolCall: { id: string; name: string }) => execute(toolCall))
  } as unknown as ToolResolver;
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
