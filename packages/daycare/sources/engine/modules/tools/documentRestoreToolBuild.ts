import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";

const schema = Type.Object(
    {
        documentId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type DocumentRestoreArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        documentId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type DocumentRestoreResult = Static<typeof resultSchema>;

const returns: ToolResultContract<DocumentRestoreResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the document_restore tool that restores a deleted document.
 * Expects: documentId resolves to a deleted row in the current user scope.
 */
export function documentRestoreToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "document_restore",
            description: "Restore a deleted document by id. Reverses a previous delete operation.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentRestoreArgs;
            const documentId = typeof payload.documentId === "string" ? payload.documentId.trim() : "";
            if (!documentId) {
                throw new Error("documentId is required.");
            }

            const restored = await storage.documents.restore(toolContext.ctx, documentId);
            const summary = `Restored document: ${restored.title} (${restored.id}).`;
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
                    documentId: restored.id,
                    version: restored.version ?? 1
                }
            };
        }
    };
}
