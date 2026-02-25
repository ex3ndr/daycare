import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Exposes } from "../../expose/exposes.js";

const schema = Type.Object(
    {
        endpointId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type ExposeRemoveArgs = Static<typeof schema>;

const exposeRemoveResultSchema = Type.Object(
    {
        summary: Type.String(),
        endpointId: Type.String()
    },
    { additionalProperties: false }
);

type ExposeRemoveResult = Static<typeof exposeRemoveResultSchema>;

const exposeRemoveReturns: ToolResultContract<ExposeRemoveResult> = {
    schema: exposeRemoveResultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the expose_remove tool for deleting expose endpoints.
 * Expects: endpointId references an existing endpoint.
 */
export function exposeRemoveToolBuild(exposes: Pick<Exposes, "remove">): ToolDefinition {
    return {
        tool: {
            name: "expose_remove",
            description: "Remove an expose endpoint and tear down its tunnel.",
            parameters: schema
        },
        returns: exposeRemoveReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as ExposeRemoveArgs;
            const endpointId = payload.endpointId.trim();
            if (!endpointId) {
                throw new Error("endpointId is required.");
            }
            const existing = await toolContext.agentSystem.storage.exposeEndpoints.findById(endpointId);
            if (!existing || existing.userId !== toolContext.ctx.userId) {
                throw new Error(`Expose endpoint not found: ${endpointId}`);
            }

            await exposes.remove(endpointId);

            const summary = `Expose endpoint removed: ${endpointId}`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                details: { endpointId },
                isError: false,
                timestamp: Date.now()
            };

            return {
                toolMessage,
                typedResult: {
                    summary,
                    endpointId
                }
            };
        }
    };
}
