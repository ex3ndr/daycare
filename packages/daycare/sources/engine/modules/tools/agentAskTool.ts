import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { AgentInboxResult, ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        id: Type.String({ minLength: 1, description: "Target agent id." }),
        prompt: Type.String({ minLength: 1, description: "Prompt sent to the target agent." })
    },
    { additionalProperties: false }
);

type AgentAskArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        answer: Type.String(),
        agentId: Type.String()
    },
    { additionalProperties: false }
);

type AgentAskResult = Static<typeof resultSchema>;

const returns: ToolResultContract<AgentAskResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.answer
};

/**
 * Sends a durable system message to another agent and waits for its reply.
 * Expects: target agent belongs to the same user and is not the current agent.
 */
export function agentAskTool(): ToolDefinition {
    return {
        tool: {
            name: "agent_ask",
            description:
                "Send a prompt to another agent and wait for its answer. Delivery is durable because the target inbox is persisted before execution.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentAskArgs;
            const agentId = payload.id.trim();
            const prompt = payload.prompt.trim();
            if (!agentId) {
                throw new Error("id is required.");
            }
            if (!prompt) {
                throw new Error("prompt is required.");
            }
            if (agentId === toolContext.agent.id) {
                throw new Error("agent_ask cannot target the current agent.");
            }

            const result = await toolContext.agentSystem.postAndAwait(
                toolContext.ctx,
                { agentId },
                {
                    type: "system_message",
                    text: prompt,
                    origin: toolContext.agent.id
                }
            );
            const answer = responseTextResolve(result, agentId);
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: answer }],
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    answer,
                    agentId
                }
            };
        }
    };
}

function responseTextResolve(result: AgentInboxResult, agentId: string): string {
    if (result.type !== "system_message" && result.type !== "message") {
        throw new Error(`agent_ask received an unexpected response type: ${result.type}`);
    }
    const responseText = result.responseText?.trim() ?? "";
    if (result.type === "system_message" && result.responseError) {
        throw new Error(result.executionErrorText?.trim() || responseText || `Agent ${agentId} failed to answer.`);
    }
    return responseText || "Agent completed without a text response.";
}
