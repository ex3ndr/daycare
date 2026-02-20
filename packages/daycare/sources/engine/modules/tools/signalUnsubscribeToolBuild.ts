import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object(
    {
        pattern: Type.String({ minLength: 1 }),
        agentId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type UnsubscribeSignalArgs = Static<typeof schema>;

const signalUnsubscribeResultSchema = Type.Object(
    {
        summary: Type.String(),
        agentId: Type.String(),
        pattern: Type.String(),
        removed: Type.Boolean()
    },
    { additionalProperties: false }
);

type SignalUnsubscribeResult = Static<typeof signalUnsubscribeResultSchema>;

const signalUnsubscribeReturns: ToolResultContract<SignalUnsubscribeResult> = {
    schema: signalUnsubscribeResultSchema,
    toLLMText: (result) => result.summary
};

export function buildSignalUnsubscribeTool(signals: Signals): ToolDefinition {
    return {
        tool: {
            name: "signal_unsubscribe",
            description:
                "Remove a signal subscription. The pattern must exactly match the one used in `signal_subscribe`. Pass `agentId` to unsubscribe another agent.",
            parameters: schema
        },
        returns: signalUnsubscribeReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as UnsubscribeSignalArgs;
            const targetAgentId = payload.agentId?.trim() ?? toolContext.agent.id;
            const agentContext = await toolContext.agentSystem.agentContextForAgentId(targetAgentId);
            if (!agentContext) {
                throw new Error(`Agent not found: ${targetAgentId}`);
            }

            const removed = signals.unsubscribe({
                userId: agentContext.userId,
                agentId: targetAgentId,
                pattern: payload.pattern
            });

            const summary = removed
                ? `Signal subscription removed for ${targetAgentId}: ${payload.pattern}.`
                : `No signal subscription found for ${targetAgentId}: ${payload.pattern}.`;
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
                details: { removed, agentId: targetAgentId, pattern: payload.pattern },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    agentId: targetAgentId,
                    pattern: payload.pattern,
                    removed
                }
            };
        }
    };
}
