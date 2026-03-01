import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
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
            const senderUsername = senderUsernameResolve(toolContext);
            const sent = await channels.send(
                toolContext.ctx,
                payload.channelName,
                senderUsername,
                payload.text,
                payload.mentions ?? []
            );

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

function senderUsernameResolve(context: ToolExecutionContext): string {
    const config = context.agent.config;
    const kind = config.kind ?? "agent";
    if (kind === "agent") {
        return usernameNormalize(config.name ?? "agent");
    }
    if (kind === "swarm") {
        return usernameNormalize(`swarm-${context.ctx.userId}`);
    }
    if (kind === "sub") {
        return usernameNormalize(config.name ?? "subagent");
    }
    if (kind === "cron") {
        return usernameNormalize(config.name ?? "cron");
    }
    if (kind === "memory") {
        return usernameNormalize("memory-agent");
    }
    if (kind === "search") {
        return usernameNormalize(config.name ?? "memory-search");
    }
    if (kind === "task") {
        return usernameNormalize(config.name ?? "task");
    }
    return usernameNormalize(context.ctx.userId || "user");
}

function usernameNormalize(value: string): string {
    const normalized = value.trim().replace(/^@+/, "").toLowerCase();
    if (!normalized) {
        throw new Error("Unable to resolve sender username for this agent.");
    }
    return normalized.replace(/\s+/g, "-");
}
