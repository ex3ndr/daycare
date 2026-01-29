import { Type, type Static } from "@sinclair/typebox";
import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { validateToolCall } from "@mariozechner/pi-ai";

import type { ConnectorManager } from "../../connectors/manager.js";
import type { MessageContext } from "../../connectors/types.js";
import { getLogger } from "../../log.js";
import type { CronScheduler } from "./cron.js";

const logger = getLogger("runtime.inference.tools");

const addCronSchema = Type.Object(
  {
    id: Type.Optional(Type.String({ minLength: 1 })),
    everyMs: Type.Number({ minimum: 1 }),
    message: Type.String({ minLength: 1 }),
    runOnStart: Type.Optional(Type.Boolean()),
    once: Type.Optional(Type.Boolean()),
    channelId: Type.Optional(Type.String({ minLength: 1 })),
    sessionId: Type.Optional(Type.String({ minLength: 1 })),
    userId: Type.Optional(
      Type.Union([Type.String({ minLength: 1 }), Type.Null()])
    )
  },
  { additionalProperties: false }
);

export type AddCronToolArgs = Static<typeof addCronSchema>;

const tools: Tool[] = [
  {
    name: "add_cron",
    description:
      "Schedule a cron task that sends a message to the current chat. Defaults to a one-shot timer unless once=false.",
    parameters: addCronSchema
  }
];

export type InferenceToolContext = {
  cron: CronScheduler | null;
  connectorManager: ConnectorManager | null;
  source: string;
  messageContext: MessageContext;
};

export function buildInferenceTools(): Tool[] {
  return tools;
}

export async function executeToolCall(
  toolCall: ToolCall,
  availableTools: Tool[],
  context: InferenceToolContext
): Promise<ToolResultMessage> {
  try {
    const args = validateToolCall(availableTools, toolCall) as AddCronToolArgs;
    switch (toolCall.name) {
      case "add_cron":
        return await handleAddCron(toolCall, args, context);
      default:
        return buildToolError(toolCall, `Unknown tool: ${toolCall.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool validation failed.";
    logger.warn({ tool: toolCall.name, error }, "Tool execution failed");
    return buildToolError(toolCall, message);
  }
}

async function handleAddCron(
  toolCall: ToolCall,
  args: AddCronToolArgs,
  context: InferenceToolContext
): Promise<ToolResultMessage> {
  if (!context.cron) {
    return buildToolError(toolCall, "Cron scheduler unavailable.");
  }

  if (!context.connectorManager) {
    return buildToolError(toolCall, "Connector manager unavailable.");
  }

  const connector = context.connectorManager.get(context.source as "telegram");
  if (!connector) {
    return buildToolError(
      toolCall,
      `Connector not loaded: ${context.source}`
    );
  }

  const task = context.cron.addTask({
    id: args.id,
    everyMs: args.everyMs,
    message: args.message,
    runOnStart: args.runOnStart,
    once: args.once ?? true,
    channelId: args.channelId ?? context.messageContext.channelId,
    sessionId: args.sessionId ?? context.messageContext.sessionId,
    userId: args.userId ?? context.messageContext.userId,
    action: "send-message",
    source: context.source
  });

  return buildToolResult(
    toolCall,
    `Scheduled cron task ${task.id} every ${task.everyMs}ms${task.once ? " (once)" : ""}.`,
    { taskId: task.id }
  );
}

function buildToolResult(
  toolCall: ToolCall,
  text: string,
  details?: Record<string, unknown>
): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    details,
    isError: false,
    timestamp: Date.now()
  };
}

function buildToolError(toolCall: ToolCall, text: string): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError: true,
    timestamp: Date.now()
  };
}
