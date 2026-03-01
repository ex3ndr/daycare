import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { agentPathTargetResolve } from "../../agents/ops/agentPathTargetResolve.js";

const schema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        now: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

type SayArgs = Static<typeof schema>;

type SayDeferredPayload = {
    connector: string;
    targetId: string;
    text: string;
    replyToMessageId?: string;
};

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
 * Sends user-visible text to the active foreground conversation target.
 * During Python execution, sending is deferred until script completion unless now=true.
 * Expects: caller is a foreground user agent with a resolvable connector target.
 */
export function sayTool(): ToolDefinition<typeof schema, SayResult> {
    return {
        tool: {
            name: "say",
            description: "Send user-visible text to the current conversation immediately.",
            parameters: schema
        },
        returns: sayReturns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, context, toolCall) => {
            const payload = args as SayArgs;
            const target = await agentPathTargetResolve(
                context.agentSystem.storage,
                context.ctx.userId,
                context.agent.config
            );
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

            // Defer sending during Python execution unless now=true
            if (context.pythonExecution && !payload.now) {
                const summary = "Message deferred.";
                const toolMessage: ToolResultMessage = {
                    role: "toolResult",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: [{ type: "text", text: summary }],
                    isError: false,
                    timestamp: Date.now()
                };
                const deferredPayload: SayDeferredPayload = {
                    connector: target.connector,
                    targetId: target.targetId,
                    text,
                    replyToMessageId: context.messageContext.messageId
                };
                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        connector: target.connector,
                        targetId: target.targetId
                    },
                    deferredPayload
                };
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
        },
        executeDeferred: async (payload: unknown, context: ToolExecutionContext) => {
            const p = payload as SayDeferredPayload;
            const connector = context.connectorRegistry.get(p.connector);
            if (!connector) {
                throw new Error(`Connector not loaded: ${p.connector}`);
            }
            await connector.sendMessage(p.targetId, {
                text: p.text,
                replyToMessageId: p.replyToMessageId
            });
        }
    };
}
