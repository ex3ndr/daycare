import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { permissionAccessParse } from "../../permissions/permissionAccessParse.js";
import { permissionTagsNormalize } from "../../permissions/permissionTagsNormalize.js";
import { permissionTagsValidate } from "../../permissions/permissionTagsValidate.js";

const startSchema = Type.Object(
    {
        prompt: Type.String({ minLength: 1 }),
        name: Type.Optional(Type.String({ minLength: 1 })),
        permissions: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }))
    },
    { additionalProperties: false }
);

const sendSchema = Type.Object(
    {
        text: Type.String({ minLength: 1 }),
        agentId: Type.Optional(Type.String({ minLength: 1 })),
        steering: Type.Optional(Type.Boolean()),
        cancelReason: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type StartBackgroundArgs = Static<typeof startSchema>;
type SendAgentMessageArgs = Static<typeof sendSchema>;

const backgroundResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String(),
        originAgentId: Type.String()
    },
    { additionalProperties: false }
);

type BackgroundResult = Static<typeof backgroundResultSchema>;

const backgroundReturns: ToolResultContract<BackgroundResult> = {
    schema: backgroundResultSchema,
    toLLMText: (result) => result.summary
};

export function buildStartBackgroundAgentTool(): ToolDefinition {
    return {
        tool: {
            name: "start_background_agent",
            description: "Start a background agent to work on a task.",
            parameters: startSchema
        },
        returns: backgroundReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as StartBackgroundArgs;
            const prompt = payload.prompt.trim();
            if (!prompt) {
                throw new Error("Background agent prompt is required");
            }
            const permissionTags = permissionTagsNormalize(payload.permissions);
            await permissionTagsValidate(toolContext.permissions, permissionTags);

            const descriptor = {
                type: "subagent" as const,
                id: createId(),
                parentAgentId: toolContext.agent.id,
                name: payload.name ?? "subagent"
            };
            const agentId = await toolContext.agentSystem.agentIdForTarget({ descriptor });
            for (const tag of permissionTags) {
                await toolContext.agentSystem.grantPermission({ agentId }, permissionAccessParse(tag));
            }
            await toolContext.agentSystem.post(
                { agentId },
                { type: "message", message: { text: prompt }, context: {} }
            );

            const summary = `Background agent started: ${agentId}.`;
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
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    targetAgentId: agentId,
                    originAgentId: toolContext.agent.id
                }
            };
        }
    };
}

export function buildSendAgentMessageTool(): ToolDefinition {
    return {
        tool: {
            name: "send_agent_message",
            description:
                "Send a system message to another agent (defaults to the most recent foreground agent). Set steering=true to interrupt the agent's current work.",
            parameters: sendSchema
        },
        returns: backgroundReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SendAgentMessageArgs;
            const descriptor = toolContext.agent.descriptor;
            const origin = toolContext.agent.id;
            const targetAgentId =
                payload.agentId ??
                (descriptor.type === "subagent" || descriptor.type === "app" ? descriptor.parentAgentId : undefined);
            const resolvedTarget = targetAgentId ?? toolContext.agentSystem.agentFor("most-recent-foreground");
            if (!resolvedTarget) {
                throw new Error("No recent foreground agent found.");
            }

            // If steering flag is set, use steering delivery
            if (payload.steering) {
                const exists = await toolContext.agentSystem.agentExists(resolvedTarget);
                if (!exists) {
                    throw new Error(`Agent not found: ${resolvedTarget}`);
                }

                await toolContext.agentSystem.steer(resolvedTarget, {
                    type: "steering",
                    text: payload.text,
                    origin,
                    cancelReason: payload.cancelReason
                });

                const summary = "Steering message delivered.";
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
                    isError: false,
                    timestamp: Date.now()
                };

                return {
                    toolMessage,
                    typedResult: {
                        summary,
                        targetAgentId: resolvedTarget,
                        originAgentId: origin
                    }
                };
            }

            // Normal system message delivery
            await toolContext.agentSystem.post(
                { agentId: resolvedTarget },
                { type: "system_message", text: payload.text, origin }
            );

            const summary = "System message sent.";
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
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    targetAgentId: resolvedTarget,
                    originAgentId: origin
                }
            };
        }
    };
}
