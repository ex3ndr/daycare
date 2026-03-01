import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Subusers } from "../../subusers/subusers.js";

const schema = Type.Object(
    {
        subuserId: Type.String({ minLength: 1 }),
        systemPrompt: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SubuserConfigureArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        subuserId: Type.String(),
        gatewayAgentId: Type.String()
    },
    { additionalProperties: false }
);

type SubuserConfigureResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SubuserConfigureResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the subuser_configure tool that updates a subuser gateway agent's system prompt.
 * Expects: caller is the owner user; subuserId references an existing child user.
 */
export function subuserConfigureToolBuild(subusers: Pick<Subusers, "configure">): ToolDefinition {
    return {
        tool: {
            name: "subuser_configure",
            description:
                "Update the system prompt of a subuser's gateway agent. Only the owner can configure subusers.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SubuserConfigureArgs;
            const subuserId = payload.subuserId.trim();
            if (!subuserId) {
                throw new Error("Subuser ID is required.");
            }
            const systemPrompt = payload.systemPrompt.trim();
            if (!systemPrompt) {
                throw new Error("System prompt is required.");
            }
            const configured = await subusers.configure(toolContext.ctx, { subuserId, systemPrompt });

            const summary = `Subuser ${subuserId} gateway agent ${configured.gatewayAgentId} system prompt updated.`;
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
                    subuserId,
                    gatewayAgentId: configured.gatewayAgentId
                }
            };
        }
    };
}
