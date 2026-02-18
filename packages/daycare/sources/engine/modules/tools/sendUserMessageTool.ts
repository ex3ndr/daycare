import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { messageBuildUserFacing } from "../../messages/messageBuildUserFacing.js";

const schema = Type.Object(
  {
    text: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type SendUserMessageArgs = Static<typeof schema>;

const sendUserMessageResultSchema = Type.Object(
  {
    summary: Type.String(),
    targetAgentId: Type.String(),
    originAgentId: Type.String()
  },
  { additionalProperties: false }
);

type SendUserMessageResult = Static<typeof sendUserMessageResultSchema>;

const sendUserMessageReturns: ToolResultContract<SendUserMessageResult> = {
  schema: sendUserMessageResultSchema,
  toLLMText: (result) => result.summary
};

/**
 * Builds the send_user_message tool for background agents.
 * Posts a <message_for_user> system message to the foreground agent,
 * forcing it to present the content to the user.
 */
export function sendUserMessageToolBuild(): ToolDefinition {
  return {
    tool: {
      name: "send_user_message",
      description:
        "Send a message that must be presented to the user. " +
        "The foreground agent will rephrase and deliver it. " +
        "Use for user-facing updates, results, or notifications.",
      parameters: schema
    },
    returns: sendUserMessageReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as SendUserMessageArgs;
      const descriptor = toolContext.agent.descriptor;
      const origin = toolContext.agent.id;

      // Resolve target: parent agent for subagents/apps, most recent foreground otherwise
      const targetAgentId =
        descriptor.type === "subagent" || descriptor.type === "app"
          ? descriptor.parentAgentId
          : undefined;
      const resolvedTarget =
        targetAgentId ?? toolContext.agentSystem.agentFor("most-recent-foreground");
      if (!resolvedTarget) {
        throw new Error("No foreground agent found to deliver the message.");
      }

      const wrappedText = messageBuildUserFacing(payload.text, origin);
      await toolContext.agentSystem.post(
        { agentId: resolvedTarget },
        { type: "system_message", text: wrappedText, origin }
      );

      const summary = "Message queued for user delivery.";
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: summary
          }
        ],
        isError: false,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          summary,
          targetAgentId: resolvedTarget,
          originAgentId: origin
        }
      };
    }
  };
}
