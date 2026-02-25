import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const searchSchema = Type.Object(
    {
        query: Type.String({ minLength: 1 }),
        sync: Type.Optional(
            Type.Boolean({
                description:
                    "When true, wait for the memory-search agent to finish and return its answer in this tool result."
            })
        )
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
 * Builds the search_memory tool that queries the memory graph.
 * Default mode is async; sync mode waits for the answer before returning.
 */
export function memorySearchToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "search_memory",
            description:
                "Search the memory graph to answer a question. By default, returns a query ID immediately and " +
                "delivers results asynchronously. Set sync=true to wait for the answer before continuing " +
                "(recommended for background agents).",
            parameters: searchSchema
        },
        returns: searchReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SearchMemoryArgs;
            const query = payload.query.trim();
            const sync = payload.sync === true;
            if (!query) {
                throw new Error("Search query is required");
            }

            const descriptor = {
                type: "memory-search" as const,
                id: createId(),
                parentAgentId: toolContext.agent.id,
                name: query
            };
            const agentId = await toolContext.agentSystem.agentIdForTarget(toolContext.ctx, { descriptor });
            const message = { type: "message" as const, message: { text: query }, context: {} };
            let summary = "";
            if (sync) {
                // Background agents often need memory before they can continue; sync mode blocks for that response.
                const result = await toolContext.agentSystem.postAndAwait(toolContext.ctx, { agentId }, message);
                const responseText = "responseText" in result ? (result.responseText?.trim() ?? "") : "";
                const summaryPrefix = `Memory query completed in sync mode. Query ID: ${agentId}.`;
                summary =
                    responseText.length > 0
                        ? `${summaryPrefix}\n\n${responseText}`
                        : `${summaryPrefix} No response text returned.`;
            } else {
                await toolContext.agentSystem.post(toolContext.ctx, { agentId }, message);
                summary = `Memory query submitted. Query ID: ${agentId}. Results will arrive asynchronously.`;
            }
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
