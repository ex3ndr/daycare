import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
import { agentHistoryRedactMessage } from "../../agents/ops/agentHistoryRedactMessage.js";

const deleteMessageSchema = Type.Object(
  {
    messageId: Type.String({ minLength: 1 }),
    source: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

type DeleteMessageArgs = Static<typeof deleteMessageSchema>;

const deleteMessageResultSchema = Type.Object(
  {
    success: Type.Boolean(),
    message: Type.String(),
    deletedFromChannel: Type.Boolean(),
    redactedFromContext: Type.Boolean(),
    redactedFromHistory: Type.Boolean()
  },
  { additionalProperties: false }
);

type DeleteMessageResult = Static<typeof deleteMessageResultSchema>;

const deleteMessageReturns: ToolResultContract<DeleteMessageResult> = {
  schema: deleteMessageResultSchema,
  toLLMText: (result) => result.message
};

/**
 * Tool for deleting messages from channel history and redacting from agent context.
 * Use for removing accidentally shared secrets or sensitive information.
 * 
 * Channel: Actually deletes the message (if connector supports it)
 * Context/History: Replaces content with <deleted> to maintain conversation flow
 */
export function buildDeleteMessageTool(): ToolDefinition {
  return {
    tool: {
      name: "delete_message",
      description:
        "Delete a message from channel history and redact from agent context. Use for removing accidentally shared secrets or sensitive information.",
      parameters: deleteMessageSchema
    },
    returns: deleteMessageReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as DeleteMessageArgs;
      const { messageId, source } = payload;

      let deletedFromChannel = false;
      let redactedFromContext = false;
      let redactedFromHistory = false;

      // Get the connector from source or current context
      const target = agentDescriptorTargetResolve(toolContext.agent.descriptor);
      const connectorSource = source ?? target?.connector;

      // Try to delete from channel if connector supports it
      if (connectorSource && toolContext.connectorRegistry) {
        const connector = toolContext.connectorRegistry.get(connectorSource);
        if (connector?.capabilities.deleteMessage && connector.deleteMessage) {
          const targetId = target?.targetId;
          if (targetId) {
            try {
              deletedFromChannel = await connector.deleteMessage(targetId, messageId);
            } catch (error) {
              // Log but continue - redaction from other sources is still valuable
              toolContext.logger.warn(
                { error, messageId, source: connectorSource },
                "delete_message: Failed to delete from channel"
              );
            }
          }
        }
      }

      // Redact from agent in-memory context (replace content with <deleted>)
      try {
        redactedFromContext = redactFromAgentContext(toolContext.agent, messageId);
      } catch (error) {
        toolContext.logger.warn(
          { error, messageId },
          "delete_message: Failed to redact from agent context"
        );
      }

      // Redact from persistent history (replace content with <deleted>)
      try {
        redactedFromHistory = await agentHistoryRedactMessage(
          toolContext.agent.config,
          toolContext.agent.id,
          messageId
        );
      } catch (error) {
        toolContext.logger.warn(
          { error, messageId },
          "delete_message: Failed to redact from agent history"
        );
      }

      const success = deletedFromChannel || redactedFromContext || redactedFromHistory;
      const parts: string[] = [];

      if (deletedFromChannel) {
        parts.push("deleted from channel");
      }
      if (redactedFromContext || redactedFromHistory) {
        parts.push("redacted from context");
      }

      const message = success
        ? `Message ${parts.join(" and ")}.`
        : "Message not found or could not be deleted.";

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: message }],
        isError: !success,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          success,
          message,
          deletedFromChannel,
          redactedFromContext,
          redactedFromHistory
        }
      };
    }
  };
}

/**
 * Redact a message from agent's in-memory context.
 * Replaces message content with <deleted> to maintain conversation flow.
 */
function redactFromAgentContext(
  agent: import("../../agents/agent.js").Agent,
  messageId: string
): boolean {
  const messages = agent.state.context.messages ?? [];
  let found = false;

  for (const msg of messages) {
    if ("content" in msg && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          if (block.text.includes(`<message_id>${messageId}</message_id>`)) {
            // Replace the entire text content with <deleted>
            block.text = "<deleted>";
            found = true;
          }
        }
      }
    }
  }

  return found;
}
