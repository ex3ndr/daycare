import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const searchSchema = Type.Object(
    {
        query: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SearchMemoryArgs = Static<typeof searchSchema>;

const searchResultSchema = Type.Object(
    {
        summary: Type.String(),
        targetAgentId: Type.String(),
        originAgentId: Type.String()
    },
    { additionalProperties: false }
);

type SearchResult = Static<typeof searchResultSchema>;

const searchReturns: ToolResultContract<SearchResult> = {
    schema: searchResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the search_memory tool that spawns a memory-search subagent.
 * The agent navigates the memory graph to answer the query asynchronously.
 */
export function memorySearchToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "search_memory",
            description:
                "Search the memory graph to answer a question. Spawns a background agent that navigates the memory graph and returns the answer asynchronously.",
            parameters: searchSchema
        },
        returns: searchReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SearchMemoryArgs;
            const query = payload.query.trim();
            if (!query) {
                throw new Error("Search query is required");
            }

            const descriptor = {
                type: "memory-search" as const,
                id: createId(),
                parentAgentId: toolContext.agent.id,
                name: query
            };
            const agentId = await toolContext.agentSystem.agentIdForTarget({ descriptor });
            await toolContext.agentSystem.post({ agentId }, { type: "message", message: { text: query }, context: {} });

            const summary = `Memory search started: ${agentId}.`;
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
