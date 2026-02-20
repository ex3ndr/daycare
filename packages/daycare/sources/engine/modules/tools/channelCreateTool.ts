import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Channels } from "../../channels/channels.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        leaderAgentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type ChannelCreateArgs = Static<typeof schema>;

const channelCreateResultSchema = Type.Object(
    {
        summary: Type.String(),
        channelId: Type.String(),
        channelName: Type.String(),
        leaderAgentId: Type.String()
    },
    { additionalProperties: false }
);

type ChannelCreateResult = Static<typeof channelCreateResultSchema>;

const channelCreateReturns: ToolResultContract<ChannelCreateResult> = {
    schema: channelCreateResultSchema,
    toLLMText: (result) => result.summary
};

export function channelCreateToolBuild(channels: Channels): ToolDefinition {
    return {
        tool: {
            name: "channel_create",
            description: "Create a channel with a designated leader agent.",
            parameters: schema
        },
        returns: channelCreateReturns,
        execute: async (args, _toolContext, toolCall) => {
            const payload = args as ChannelCreateArgs;
            const channel = await channels.create(payload.name, payload.leaderAgentId);
            const summary = `Channel created: #${channel.name} (leader=${channel.leader}).`;
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
                    channelId: channel.id,
                    channelName: channel.name,
                    leaderAgentId: channel.leader
                }
            };
        }
    };
}
