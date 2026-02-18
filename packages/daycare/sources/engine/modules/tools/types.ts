import type { Tool, ToolResultMessage } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";

import type { MessageContext } from "@/types";
import type { AgentHistoryRecord } from "../../agents/ops/agentTypes.js";
import type { ConnectorRegistry } from "../connectorRegistry.js";
import type { FileStore } from "../../../files/store.js";
import type { Agent } from "../../agents/agent.js";
import type { AuthStore } from "../../../auth/store.js";
import type { Logger } from "pino";
import type { AssistantSettings } from "../../../settings.js";
import type { SessionPermissions } from "@/types";
import type { AgentSystem } from "../../agents/agentSystem.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { PermissionRequestRegistry } from "./permissionRequestRegistry.js";
import type { AgentSkill } from "../../skills/skillTypes.js";
import type { ToolResolverApi } from "../toolResolver.js";

export type ToolExecutionContext<State = Record<string, unknown>> = {
  connectorRegistry: ConnectorRegistry;
  fileStore: FileStore;
  auth: AuthStore;
  logger: Logger;
  assistant: AssistantSettings | null;
  permissions: SessionPermissions;
  agent: Agent;
  source: string;
  messageContext: MessageContext;
  agentSystem: AgentSystem;
  heartbeats: Heartbeats;
  toolResolver?: ToolResolverApi;
  skills?: AgentSkill[];
  permissionRequestRegistry?: PermissionRequestRegistry;
  appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>;
  rlmToolOnly?: boolean;
};

export type ToolResultPrimitive = string | number | boolean | null;

export type ToolResultRow = Record<string, ToolResultPrimitive>;

export type ToolResultShallowObject = Record<
  string,
  ToolResultPrimitive | ToolResultRow[]
>;

export type ToolResultOutcomeObject = {
  toolCallId: string;
  toolName: string;
  isError: boolean;
  timestamp: number;
  text: string;
};

export type ToolResultContract<
  TResult extends ToolResultShallowObject = ToolResultShallowObject
> = {
  schema: TSchema;
  toLLMText(result: TResult): string;
};

export type ToolExecutionResult<
  TResult extends ToolResultShallowObject = ToolResultShallowObject
> = {
  toolMessage: ToolResultMessage;
  typedResult: TResult;
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
};
