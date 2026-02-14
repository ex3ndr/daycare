import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Channels } from "../../channels/channels.js";

const schema = Type.Object(
  {
    channelName: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200 }))
  },
  { additionalProperties: false }
);

type ChannelHistoryArgs = Static<typeof schema>;

export function channelHistoryToolBuild(channels: Channels): ToolDefinition {
  return {
    tool: {
      name: "channel_history",
      description: "Read recent message history for a channel.",
      parameters: schema
    },
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ChannelHistoryArgs;
      const history = await channels.getHistory(payload.channelName, payload.limit);
      const lines = history.map((message) =>
        `[${message.createdAt}] @${message.senderUsername}: ${message.text}`
      );
      const text =
        lines.length === 0
          ? `No messages in #${payload.channelName}.`
          : lines.join("\n");

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          channelName: payload.channelName,
          count: history.length,
          messages: history
        },
        isError: false,
        timestamp: Date.now()
      };
      return { toolMessage, files: [] };
    }
  };
}

