import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";

const schema = Type.Object(
    {
        reaction: Type.String({ minLength: 1 }),
        messageId: Type.Optional(Type.String({ minLength: 1 })),
        source: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type ReactionArgs = Static<typeof schema>;

const reactionResultSchema = Type.Object(
    {
        summary: Type.String(),
        reaction: Type.String(),
        messageId: Type.String(),
        source: Type.String()
    },
    { additionalProperties: false }
);

type ReactionResult = Static<typeof reactionResultSchema>;

const reactionReturns: ToolResultContract<ReactionResult> = {
    schema: reactionResultSchema,
    toLLMText: (result) => result.summary
};

export function buildReactionTool(): ToolDefinition {
    return {
        tool: {
            name: "set_reaction",
            description: "Set a reaction emoji on a message in the active connector.",
            parameters: schema
        },
        returns: reactionReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ReactionArgs;
            if (!toolContext.connectorRegistry) {
                throw new Error("Connector registry unavailable");
            }
            const target = await agentPathTargetResolve(
                toolContext.agentSystem.storage,
                toolContext.ctx.userId,
                toolContext.agent.config,
                toolContext.agent.path
            );
            if (!target) {
                throw new Error("Reactions require a user agent.");
            }
            const source = payload.source ?? target.connector;
            if (source !== target.connector) {
                throw new Error("Reaction source must match the agent connector.");
            }
            const connector = toolContext.connectorRegistry.get(source);
            if (!connector || !connector.capabilities.reactions || !connector.setReaction) {
                throw new Error(`Connector does not support reactions: ${source}`);
            }
            const messageId = payload.messageId ?? toolContext.messageContext.messageId;
            if (!messageId) {
                throw new Error("Missing message id for reaction");
            }
            await connector.setReaction(target.targetId, String(messageId), payload.reaction);

            const summary = `Reaction set: ${payload.reaction}`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    reaction: payload.reaction,
                    messageId: String(messageId),
                    source
                }
            };
        }
    };
}
