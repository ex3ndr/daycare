import type { Tool, ToolResultMessage } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";

import type { FileReference, MessageContext } from "@/types";
import type { ConnectorRegistry } from "../connectorRegistry.js";
import type { FileStore } from "../../../files/store.js";
import type { Agent } from "../../agents/agent.js";
import type { AuthStore } from "../../../auth/store.js";
import type { Logger } from "pino";
import type { AssistantSettings } from "../../../settings.js";
import type { SessionPermissions } from "@/types";
import type { AgentSystem } from "../../agents/agentSystem.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";

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
};

export type ToolExecutionResult = {
  toolMessage: ToolResultMessage;
  files: FileReference[];
};

export type ToolDefinition<TParams extends TSchema = TSchema> = {
  tool: Tool<TParams>;
  execute: (
    args: unknown,
    context: ToolExecutionContext,
    toolCall: { id: string; name: string }
  ) => Promise<ToolExecutionResult>;
};
