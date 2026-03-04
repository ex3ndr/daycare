import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        fragmentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FragmentArchiveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        fragmentId: Type.String()
    },
    { additionalProperties: false }
);

type FragmentArchiveResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FragmentArchiveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the fragment_archive tool that soft-archives an existing fragment.
 * Expects: fragmentId resolves to an existing row in the current user scope.
 */
export function fragmentArchiveToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "fragment_archive",
            description: "Archive a fragment by id. Archived fragments are hidden from list views.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as FragmentArchiveArgs;
            const fragmentId = typeof payload.fragmentId === "string" ? payload.fragmentId.trim() : "";
            if (!fragmentId) {
                throw new Error("fragmentId is required.");
            }

            await storage.fragments.archive(toolContext.ctx, fragmentId);
            const summary = `Archived fragment: ${fragmentId}.`;
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
