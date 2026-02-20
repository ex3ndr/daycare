import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
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

const channelMemberResultSchema = Type.Object(
    {
        summary: Type.String(),
        channelName: Type.String(),
        agentId: Type.String(),
        username: Type.Optional(Type.String()),
        removed: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type ChannelMemberResult = Static<typeof channelMemberResultSchema>;

const channelMemberReturns: ToolResultContract<ChannelMemberResult> = {
    schema: channelMemberResultSchema,
    toLLMText: (result) => result.summary
};

export function channelAddMemberToolBuild(channels: Channels): ToolDefinition {
    return {
        tool: {
            name: "channel_add_member",
            description: "Add an agent member to a channel with a username handle.",
            parameters: addMemberSchema
        },
        returns: channelMemberReturns,
        execute: async (args, _toolContext, toolCall) => {
            const payload = args as ChannelAddMemberArgs;
            const channel = await channels.addMember(payload.channelName, payload.agentId, payload.username);
            const summary = `Added @${payload.username} (${payload.agentId}) to #${channel.name}.`;
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
                details: { channel },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    channelName: channel.name,
                    agentId: payload.agentId,
                    username: payload.username
                }
            };
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
        returns: channelMemberReturns,
        execute: async (args, _toolContext, toolCall) => {
            const payload = args as ChannelRemoveMemberArgs;
            const removed = await channels.removeMember(payload.channelName, payload.agentId);
            const summary = removed
                ? `Removed ${payload.agentId} from #${payload.channelName}.`
                : `${payload.agentId} is not a member of #${payload.channelName}.`;
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
                details: {
                    channelName: payload.channelName,
                    agentId: payload.agentId,
                    removed
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    channelName: payload.channelName,
                    agentId: payload.agentId,
                    removed
                }
            };
        }
    };
}
