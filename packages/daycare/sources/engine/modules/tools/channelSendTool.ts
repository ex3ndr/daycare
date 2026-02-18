import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultText, toolReturnText } from "./toolReturnText.js";
import { Type, type Static } from "@sinclair/typebox";

import type { AgentDescriptor, ToolDefinition } from "@/types";
import type { Channels } from "../../channels/channels.js";

const schema = Type.Object(
  {
    channelName: Type.String({ minLength: 1 }),
    text: Type.String({ minLength: 1 }),
    mentions: Type.Optional(Type.Array(Type.String({ minLength: 1 })))
  },
  { additionalProperties: false }
);

type ChannelSendArgs = Static<typeof schema>;

export function channelSendToolBuild(channels: Channels): ToolDefinition {
  return {
    tool: {
      name: "channel_send",
      description: "Send a message to a channel. Mentioned usernames receive it plus the leader.",
      parameters: schema
    },
    returns: toolReturnText,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as ChannelSendArgs;
      const senderUsername = senderUsernameResolve(toolContext.agent.descriptor);
      const sent = await channels.send(
        payload.channelName,
        senderUsername,
        payload.text,
        payload.mentions ?? []
      );

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text:
              `Sent message to #${sent.message.channelName} as @${senderUsername}. ` +
              `Delivered to ${sent.deliveredAgentIds.length} agent(s).`
          }
        ],
        details: {
          senderUsername,
          message: sent.message,
          deliveredAgentIds: sent.deliveredAgentIds
        },
        isError: false,
        timestamp: Date.now()
      };
      return toolExecutionResultText(toolMessage);
    }
  };
}

function senderUsernameResolve(descriptor: AgentDescriptor): string {
  if (descriptor.type === "permanent") {
    return usernameNormalize(descriptor.username ?? descriptor.name);
  }
  if (descriptor.type === "subagent") {
    return usernameNormalize(descriptor.name);
  }
  if (descriptor.type === "app") {
    return usernameNormalize(descriptor.name);
  }
  if (descriptor.type === "cron") {
    return usernameNormalize(descriptor.name ?? descriptor.id);
  }
  if (descriptor.type === "system") {
    return usernameNormalize(descriptor.tag);
  }
  return usernameNormalize(descriptor.userId);
}

function usernameNormalize(value: string): string {
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!normalized) {
    throw new Error("Unable to resolve sender username for this agent.");
  }
  return normalized.replace(/\s+/g, "-");
}
