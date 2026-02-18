import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultText, toolReturnText } from "./toolReturnText.js";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Channels } from "../../channels/channels.js";

const schema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    leaderAgentId: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type ChannelCreateArgs = Static<typeof schema>;

export function channelCreateToolBuild(channels: Channels): ToolDefinition {
  return {
    tool: {
      name: "channel_create",
      description: "Create a channel with a designated leader agent.",
      parameters: schema
    },
    returns: toolReturnText,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ChannelCreateArgs;
      const channel = await channels.create(payload.name, payload.leaderAgentId);
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: `Channel created: #${channel.name} (leader=${channel.leader}).`
          }
        ],
        details: { channel },
        isError: false,
        timestamp: Date.now()
      };
      return toolExecutionResultText(toolMessage);
    }
  };
}

