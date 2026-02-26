import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SayArgs = Static<typeof schema>;

const sayResultSchema = Type.Object(
    {
        summary: Type.String(),
        connector: Type.String(),
        targetId: Type.String()
    },
    { additionalProperties: false }
);

type SayResult = Static<typeof sayResultSchema>;

const sayReturns: ToolResultContract<SayResult> = {
    schema: sayResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the foreground-only say tool for immediate user-visible replies.
 * Expects: caller is a user agent with a resolvable connector target.
 */
export function sayTool(): ToolDefinition<typeof schema, SayResult> {
    return {
        tool: {
            name: "say",
            description:
                "Send user-visible text to the current conversation immediately. Prefer this over <say> tags when available.",
            parameters: schema
        },
        returns: sayReturns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, context, toolCall) => {
            const payload = args as SayArgs;
            const target = agentDescriptorTargetResolve(context.agent.descriptor);
            if (!target) {
                throw new Error("say is only available for foreground user agents.");
            }
            const connector = context.connectorRegistry.get(target.connector);
            if (!connector) {
                throw new Error(`Connector not loaded: ${target.connector}`);
            }
            const text = payload.text.trim();
            if (!text) {
                throw new Error("Text is required.");
            }

            await connector.sendMessage(target.targetId, {
                text,
                replyToMessageId: context.messageContext.messageId
            });

            const summary = "Sent user-visible message.";
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
                    connector: target.connector,
                    targetId: target.targetId
                }
            };
        }
    };
}
