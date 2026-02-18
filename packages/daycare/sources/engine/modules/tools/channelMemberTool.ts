import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultText, toolReturnText } from "./toolReturnText.js";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Channels } from "../../channels/channels.js";

const addMemberSchema = Type.Object(
  {
    channelName: Type.String({ minLength: 1 }),
    agentId: Type.String({ minLength: 1 }),
    username: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

const removeMemberSchema = Type.Object(
  {
    channelName: Type.String({ minLength: 1 }),
    agentId: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type ChannelAddMemberArgs = Static<typeof addMemberSchema>;
type ChannelRemoveMemberArgs = Static<typeof removeMemberSchema>;

export function channelAddMemberToolBuild(channels: Channels): ToolDefinition {
  return {
    tool: {
      name: "channel_add_member",
      description: "Add an agent member to a channel with a username handle.",
      parameters: addMemberSchema
    },
    returns: toolReturnText,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ChannelAddMemberArgs;
      const channel = await channels.addMember(
        payload.channelName,
        payload.agentId,
        payload.username
      );
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: `Added @${payload.username} (${payload.agentId}) to #${channel.name}.`
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

export function channelRemoveMemberToolBuild(channels: Channels): ToolDefinition {
  return {
    tool: {
      name: "channel_remove_member",
      description: "Remove an agent member from a channel.",
      parameters: removeMemberSchema
    },
    returns: toolReturnText,
    execute: async (args, _toolContext, toolCall) => {
      const payload = args as ChannelRemoveMemberArgs;
      const removed = await channels.removeMember(payload.channelName, payload.agentId);
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: removed
              ? `Removed ${payload.agentId} from #${payload.channelName}.`
              : `${payload.agentId} is not a member of #${payload.channelName}.`
          }
        ],
        details: {
          channelName: payload.channelName,
          agentId: payload.agentId,
          removed
        },
        isError: false,
        timestamp: Date.now()
      };
      return toolExecutionResultText(toolMessage);
    }
  };
}

