import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
import { agentHistoryTruncateAfter } from "../../agents/ops/agentHistoryTruncateAfter.js";

const deleteAfterSchema = Type.Object(
  {
    messageId: Type.String({ minLength: 1 }),
    reason: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

type DeleteAfterArgs = Static<typeof deleteAfterSchema>;

const deleteAfterResultSchema = Type.Object(
  {
    success: Type.Boolean(),
    message: Type.String(),
    deletedCount: Type.Number(),
    deletedFromChannel: Type.Boolean()
  },
  { additionalProperties: false }
);

type DeleteAfterResult = Static<typeof deleteAfterResultSchema>;

const deleteAfterReturns: ToolResultContract<DeleteAfterResult> = {
  schema: deleteAfterResultSchema,
  toLLMText: (result) => result.message
};

/**
 * Tool for deleting all messages after a specific point in the conversation.
 * Use for rolling back the conversation when sensitive information was shared.
 * 
 * Channel: Attempts to delete messages from the external platform (best effort)
 * Context/History: Truncates everything after the specified messageId and inserts
 *                  a <messages_deleted> marker with the provided reason.
 */
export function buildDeleteAfterTool(): ToolDefinition {
  return {
    tool: {
      name: "delete_after",
      description:
        "Delete all messages after a specific message ID. Use for rolling back the conversation when sensitive information was shared. Truncates context/history and optionally deletes from channel.",
      parameters: deleteAfterSchema
    },
    returns: deleteAfterReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as DeleteAfterArgs;
      const { messageId, reason } = payload;

      let deletedFromChannel = false;
      let deletedCount = 0;

      // Get the connector from current context
      const target = agentDescriptorTargetResolve(toolContext.agent.descriptor);
      const connectorSource = target?.connector;

      // Get messages to delete from channel (those after messageId)
      const messagesToDelete = getMessagesAfter(toolContext.agent, messageId);

      // Try to delete from channel if connector supports it
      if (connectorSource && toolContext.connectorRegistry && messagesToDelete.length > 0) {
        const connector = toolContext.connectorRegistry.get(connectorSource);
        if (connector?.capabilities.deleteMessage && connector.deleteMessage) {
          const targetId = target?.targetId;
          if (targetId) {
            let channelDeleted = 0;
            for (const msgId of messagesToDelete) {
              try {
                const deleted = await connector.deleteMessage(targetId, msgId);
                if (deleted) channelDeleted++;
              } catch (error) {
                toolContext.logger.warn(
                  { error, messageId: msgId, source: connectorSource },
                  "delete_after: Failed to delete message from channel"
                );
              }
            }
            deletedFromChannel = channelDeleted > 0;
          }
        }
      }

      // Truncate from context and history
      try {
        // Truncate in-memory context
        const contextDeleted = truncateContextAfter(toolContext.agent, messageId, reason);
        
        // Truncate persistent history
        const historyResult = await agentHistoryTruncateAfter(
          toolContext.agent.config,
          toolContext.agent.id,
          messageId,
          reason
        );
        
        deletedCount = Math.max(contextDeleted, historyResult.deletedCount);
      } catch (error) {
        toolContext.logger.warn(
          { error, messageId },
          "delete_after: Failed to truncate context/history"
        );
      }

      const success = deletedCount > 0;
      
      let message: string;
      if (success) {
        const parts: string[] = [];
        parts.push(`${deletedCount} message(s) removed from context`);
        if (deletedFromChannel) {
          parts.push("deleted from channel");
        }
        message = `Conversation rolled back: ${parts.join(", ")}.`;
      } else {
        message = "Message ID not found or nothing to delete.";
      }

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
          deletedCount,
          deletedFromChannel
        }
      };
    }
  };
}

/**
 * Get all message IDs that appear after the specified messageId in context.
 */
function getMessagesAfter(
  agent: import("../../agents/agent.js").Agent,
  messageId: string
): string[] {
  const messages = agent.state.context.messages ?? [];
  const ids: string[] = [];
  let foundTarget = false;

  for (const msg of messages) {
    if ("content" in msg && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          // Check for messageId tag
          const match = block.text.match(/<message_id>(\d+)<\/message_id>/);
          if (match) {
            const currentId = match[1];
            if (foundTarget && currentId) {
              ids.push(currentId);
            } else if (currentId === messageId) {
              foundTarget = true;
            }
          }
        }
      }
    }
  }

  return ids;
}

/**
 * Truncate context to keep only messages up to and including the target messageId.
 * Inserts a marker message explaining the deletion.
 * Returns the number of messages removed.
 */
function truncateContextAfter(
  agent: import("../../agents/agent.js").Agent,
  messageId: string,
  reason?: string
): number {
  const messages = agent.state.context.messages ?? [];
  let cutIndex = -1;

  // Find the message with the target messageId
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if ("content" in msg && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          if (block.text.includes(`<message_id>${messageId}</message_id>`)) {
            cutIndex = i;
            break;
          }
        }
      }
    }
    if (cutIndex !== -1) break;
  }

  if (cutIndex === -1) {
    return 0;
  }

  const originalLength = messages.length;
  const deletedCount = originalLength - cutIndex - 1;

  if (deletedCount <= 0) {
    return 0;
  }

  // Keep messages up to and including the target, then add deletion marker
  const kept = messages.slice(0, cutIndex + 1);
  
  // Add a system message marker about the deletion
  const reasonText = reason ? ` reason="${reason}"` : "";
  const markerMessage = {
    role: "user" as const,
    content: [
      {
        type: "text" as const,
        text: `<messages_deleted count="${deletedCount}"${reasonText}/>`
      }
    ]
  };

  agent.state.context.messages = [...kept, markerMessage];

  return deletedCount;
}
