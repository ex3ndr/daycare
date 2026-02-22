import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { AgentDescriptor, ToolDefinition, ToolResultContract } from "@/types";
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

const channelSendResultSchema = Type.Object(
    {
        summary: Type.String(),
        channelName: Type.String(),
        senderUsername: Type.String(),
        deliveredCount: Type.Number()
    },
    { additionalProperties: false }
);

type ChannelSendResult = Static<typeof channelSendResultSchema>;

const channelSendReturns: ToolResultContract<ChannelSendResult> = {
    schema: channelSendResultSchema,
    toLLMText: (result) => result.summary
};

export function channelSendToolBuild(channels: Channels): ToolDefinition {
    return {
        tool: {
            name: "channel_send",
            description: "Send a message to a channel. Mentioned usernames receive it plus the leader.",
            parameters: schema
        },
        returns: channelSendReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ChannelSendArgs;
            const senderUsername = senderUsernameResolve(toolContext.agent.descriptor);
            const sent = await channels.send(payload.channelName, senderUsername, payload.text, payload.mentions ?? []);

            const summary =
                `Sent message to #${sent.message.channelName} as @${senderUsername}. ` +
                `Delivered to ${sent.deliveredAgentIds.length} agent(s).`;
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
                    senderUsername,
                    message: sent.message,
                    deliveredAgentIds: sent.deliveredAgentIds
                },
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    channelName: sent.message.channelName,
                    senderUsername,
                    deliveredCount: sent.deliveredAgentIds.length
                }
            };
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
    if (descriptor.type === "memory-agent") {
        return usernameNormalize("memory-agent");
    }
    if (descriptor.type === "memory-search") {
        return usernameNormalize(descriptor.name);
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
