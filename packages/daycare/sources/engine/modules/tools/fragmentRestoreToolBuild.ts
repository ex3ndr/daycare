import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        fragmentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FragmentRestoreArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragmentId: Type.String()
    },
    { additionalProperties: false }
);

type FragmentRestoreResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FragmentRestoreResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the fragment_restore tool that unarchives an archived fragment.
 * Expects: fragmentId resolves to an archived row in the current user scope.
 */
export function fragmentRestoreToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "fragment_restore",
            description: "Restore an archived fragment by id. Reverses a previous archive operation.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as FragmentRestoreArgs;
            const fragmentId = typeof payload.fragmentId === "string" ? payload.fragmentId.trim() : "";
            if (!fragmentId) {
                throw new Error("fragmentId is required.");
            }

            await storage.fragments.unarchive(toolContext.ctx, fragmentId);
            const summary = `Restored fragment: ${fragmentId}.`;
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
                    fragmentId
                }
            };
        }
    };
}
