import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        name: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type SecretRemoveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        name: Type.String(),
        status: Type.String()
    },
    { additionalProperties: false }
);

type SecretRemoveResult = {
    summary: string;
    name: string;
    status: "removed" | "not_found";
};

const returns: ToolResultContract<SecretRemoveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Removes a named secret from the caller's user scope.
 * Expects: name is a non-empty secret key.
 */
export function secretRemoveToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "secret_remove",
            description: "Remove a named secret from your saved secrets list.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as SecretRemoveArgs;
            if (!toolContext.secrets) {
                throw new Error("Secrets service is not configured.");
            }
            const name = payload.name.trim();
            if (!name) {
                throw new Error("name is required.");
            }
            const removed = await toolContext.secrets.remove(toolContext.ctx, name);
            const status: SecretRemoveResult["status"] = removed ? "removed" : "not_found";
            const summary = removed ? `Secret "${name}" removed.` : `Secret "${name}" not found.`;

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
                    name,
                    status
                }
            };
        }
    };
}
