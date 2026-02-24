import type { Tool, ToolResultMessage } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";
import type { Logger } from "pino";
import type { AgentDescriptor, Context, MessageContext } from "@/types";
import type { AuthStore } from "../../../auth/store.js";
import type { Sandbox } from "../../../sandbox/sandbox.js";
import type { AssistantSettings } from "../../../settings.js";
import type { Agent } from "../../agents/agent.js";
import type { AgentSystem } from "../../agents/agentSystem.js";
import type { AgentHistoryRecord } from "../../agents/ops/agentTypes.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { Memory } from "../../memory/memory.js";
import type { AgentSkill } from "../../skills/skillTypes.js";
import type { ConnectorRegistry } from "../connectorRegistry.js";
import type { ToolResolverApi } from "../toolResolver.js";

export type ToolVisibilityContext = {
    ctx: Context;
    descriptor: AgentDescriptor;
};

export type ToolExecutionContext<_State = Record<string, unknown>> = {
    connectorRegistry: ConnectorRegistry;
    sandbox: Sandbox;
    auth: AuthStore;
    logger: Logger;
    assistant: AssistantSettings | null;
    agent: Agent;
    ctx: Context;
    source: string;
    messageContext: MessageContext;
    agentSystem: AgentSystem;
    heartbeats: Heartbeats;
    memory?: Memory;
    toolResolver?: ToolResolverApi;
    skills?: AgentSkill[];
    skillsActiveRoot?: string;
    appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>;
    rlmToolOnly?: boolean;
    allowedToolNames?: ReadonlySet<string>;
};

export type ToolResultPrimitive = string | number | boolean | null;

export type ToolResultRow = Record<string, ToolResultPrimitive>;

export type ToolResultShallowObject = Record<string, ToolResultPrimitive | ToolResultRow[]>;

export type ToolResultOutcomeObject = {
    toolCallId: string;
    toolName: string;
    isError: boolean;
    timestamp: number;
    text: string;
};

export type ToolResultContract<TResult extends ToolResultShallowObject = ToolResultShallowObject> = {
    schema: TSchema;
    toLLMText(result: TResult): string;
};

export type ToolExecutionResult<TResult extends ToolResultShallowObject = ToolResultShallowObject> = {
    toolMessage: ToolResultMessage;
    typedResult: TResult;
    skipTurn?: boolean;
};

export type ToolDefinition<
    TParams extends TSchema = TSchema,
    TResult extends ToolResultShallowObject = ToolResultShallowObject
> = {
    tool: Tool<TParams>;
    returns: ToolResultContract<TResult>;
    execute: (
        args: unknown,
        context: ToolExecutionContext,
        toolCall: { id: string; name: string }
    ) => Promise<ToolExecutionResult<TResult>>;
    visibleByDefault?: (context: ToolVisibilityContext) => boolean;
};
