import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        agentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type AgentCompactArgs = Static<typeof schema>;

const agentCompactResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String()
    },
    { additionalProperties: false }
);

type AgentCompactResult = Static<typeof agentCompactResultSchema>;

const agentCompactReturns: ToolResultContract<AgentCompactResult> = {
    schema: agentCompactResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the agent_compact tool to request context compaction for an existing agent.
 * Expects: agentId resolves to an existing agent.
 */
export function agentCompactToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "agent_compact",
            description: "Compact an existing agent session by id.",
            parameters: schema
        },
        returns: agentCompactReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as AgentCompactArgs;
            const targetAgentId = payload.agentId.trim();
            if (!targetAgentId) {
                throw new Error("agentId is required.");
            }
            if (targetAgentId === toolContext.agent.id) {
                throw new Error("Cannot compact the current agent.");
            }
            const exists = await toolContext.agentSystem.agentExists(targetAgentId);
            if (!exists) {
                throw new Error(`Agent not found: ${targetAgentId}`);
            }
            const targetCtx =
                typeof toolContext.agentSystem.contextForAgentId === "function"
                    ? await toolContext.agentSystem.contextForAgentId(targetAgentId)
                    : { userId: toolContext.ctx?.userId ?? "owner", agentId: targetAgentId };
            if (!targetCtx || (toolContext.ctx && targetCtx.userId !== toolContext.ctx.userId)) {
                throw new Error(`Agent not found: ${targetAgentId}`);
            }
            const postFn = toolContext.agentSystem.post as unknown as (...args: unknown[]) => Promise<void>;
            if (toolContext.ctx) {
                await postFn(toolContext.ctx, { agentId: targetAgentId }, { type: "compact" });
            } else {
                await postFn({ agentId: targetAgentId }, { type: "compact" });
            }

            const summary = `Agent compaction requested: ${targetAgentId}.`;
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
