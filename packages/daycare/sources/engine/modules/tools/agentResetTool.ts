import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        agentId: Type.String({ minLength: 1 }),
        message: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type AgentResetArgs = Static<typeof schema>;

const agentResetResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String()
    },
    { additionalProperties: false }
);

type AgentResetResult = Static<typeof agentResetResultSchema>;

const agentResetReturns: ToolResultContract<AgentResetResult> = {
    schema: agentResetResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the agent_reset tool to request a session reset for an existing agent.
 * Expects: agentId resolves to an existing agent; optional message is non-empty when provided.
 */
export function agentResetToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "agent_reset",
            description: "Reset an existing agent session by id.",
            parameters: schema
        },
        returns: agentResetReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentResetArgs;
            const targetAgentId = payload.agentId.trim();
            if (!targetAgentId) {
                throw new Error("agentId is required.");
            }
            if (targetAgentId === toolContext.agent.id) {
                throw new Error("Cannot reset the current agent.");
            }
            const exists = await toolContext.agentSystem.agentExists(targetAgentId);
            if (!exists) {
                throw new Error(`Agent not found: ${targetAgentId}`);
            }
            const message = payload.message?.trim();
            if (payload.message !== undefined && !message) {
                throw new Error("message must be non-empty when provided.");
            }
            await toolContext.agentSystem.post(
                { agentId: targetAgentId },
                message ? { type: "reset", message } : { type: "reset" }
            );

            const summary = `Agent reset requested: ${targetAgentId}.`;
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
                    targetAgentId
                }
            };
        }
    };
}
