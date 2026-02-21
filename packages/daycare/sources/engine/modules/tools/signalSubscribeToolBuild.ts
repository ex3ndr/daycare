import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object(
    {
        pattern: Type.String({ minLength: 1 }),
        silent: Type.Optional(Type.Boolean()),
        agentId: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type SubscribeSignalArgs = Static<typeof schema>;

const signalSubscribeResultSchema = Type.Object(
    {
        summary: Type.String(),
        agentId: Type.String(),
        pattern: Type.String(),
        silent: Type.Boolean()
    },
    { additionalProperties: false }
);

type SignalSubscribeResult = Static<typeof signalSubscribeResultSchema>;

const signalSubscribeReturns: ToolResultContract<SignalSubscribeResult> = {
    schema: signalSubscribeResultSchema,
    toLLMText: (result) => result.summary
};

export function buildSignalSubscribeTool(signals: Signals): ToolDefinition {
    return {
        tool: {
            name: "signal_subscribe",
            description:
                "Subscribe to signals matching a pattern. Pattern uses colon-separated segments with `*` as a single-segment wildcard (e.g. `build:*:done` matches `build:alpha:done` but not `build:alpha:beta:done`). Defaults to silent delivery (won't wake a sleeping agent); set `silent=false` to wake on signal. Pass `agentId` to subscribe another agent.",
            parameters: schema
        },
        returns: signalSubscribeReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SubscribeSignalArgs;
            const targetAgentId = payload.agentId?.trim() ?? toolContext.agent.id;
            const ctx = await toolContext.agentSystem.contextForAgentId(targetAgentId);
            if (!ctx) {
                throw new Error(`Agent not found: ${targetAgentId}`);
            }

            const subscription = await signals.subscribe({
                ctx,
                pattern: payload.pattern,
                silent: payload.silent
            });

            const summary = `Signal subscription saved for ${subscription.ctx.agentId}: ${subscription.pattern} (silent=${subscription.silent}).`;
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
                details: { subscription },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    agentId: subscription.ctx.agentId,
                    pattern: subscription.pattern,
                    silent: subscription.silent
                }
            };
        }
    };
}
