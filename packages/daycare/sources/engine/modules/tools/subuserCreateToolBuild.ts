import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import type { Subusers } from "../../subusers/subusers.js";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 }),
        systemPrompt: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SubuserCreateArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        subuserId: Type.String(),
        gatewayAgentId: Type.String(),
        name: Type.String()
    },
    { additionalProperties: false }
);

type SubuserCreateResult = Static<typeof resultSchema>;

const returns: ToolResultContract<SubuserCreateResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the subuser_create tool that provisions an isolated child user with a gateway agent.
 * Expects: caller is the owner user; name and systemPrompt are non-empty.
 */
export function subuserCreateToolBuild(subusers: Pick<Subusers, "create">): ToolDefinition {
    return {
        tool: {
            name: "subuser_create",
            description:
                "Create an isolated subuser with its own memory, filesystem, and a gateway agent. " +
                "Only the owner can create subusers. The gateway agent receives messages forwarded by owner agents.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SubuserCreateArgs;
            const name = payload.name.trim();
            if (!name) {
                throw new Error("Subuser name is required.");
            }
            const systemPrompt = payload.systemPrompt.trim();
            if (!systemPrompt) {
                throw new Error("Subuser system prompt is required.");
            }
            const created = await subusers.create(toolContext.ctx, { name, systemPrompt });

            const summary = `Subuser created: ${created.subuserId} (name: ${name}). Gateway agent: ${created.gatewayAgentId}.`;
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
                    subuserId: created.subuserId,
                    gatewayAgentId: created.gatewayAgentId,
                    name
                }
            };
        }
    };
}
