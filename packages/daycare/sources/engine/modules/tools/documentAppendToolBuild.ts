import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { peopleDocumentFrontmatterAssert } from "../../people/peopleDocumentFrontmatterAssert.js";
import { documentMutationMemoryScopeAssert } from "./documentMutationMemoryScopeAssert.js";
import { documentMutationTargetResolve } from "./documentMutationTargetResolve.js";

const schema = Type.Object(
    {
        documentId: Type.Optional(Type.String({ minLength: 1 })),
        path: Type.Optional(Type.String({ minLength: 1 })),
        text: Type.String({
            minLength: 1,
            description: "Text to append exactly to the end of the existing document body."
        })
    },
    { additionalProperties: false }
);

type DocumentAppendArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        documentId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type DocumentAppendResult = Static<typeof resultSchema>;

const returns: ToolResultContract<DocumentAppendResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the document_append tool that appends text to an existing document body.
 * Expects: exactly one selector (`documentId` or `path`) and non-empty append text.
 */
export function documentAppendToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "document_append",
            description:
                "Append text to the end of an existing document body. " +
                "Provide exactly one selector: documentId or path (~/a/b).",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentAppendArgs;
            const document = await documentMutationTargetResolve(toolContext.ctx, payload, storage.documents);
            await documentMutationMemoryScopeAssert(toolContext, storage.documents, document.id);

            const nextBody = `${document.body}${payload.text}`;
            await peopleDocumentFrontmatterAssert({
                ctx: toolContext.ctx,
                documents: storage.documents,
                parentId: await storage.documents.findParentId(toolContext.ctx, document.id),
                body: nextBody
            });

            const updated = await storage.documents.update(toolContext.ctx, document.id, {
                body: nextBody,
                updatedAt: Date.now()
            });
            const version = updated.version ?? 1;
            const summary = `Appended text to document: ${document.id} (version ${version}).`;
            return toolResultBuild(toolCall, {
                summary,
                documentId: document.id,
                version
            });
        }
    };
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: DocumentAppendResult
): { toolMessage: ToolResultMessage; typedResult: DocumentAppendResult } {
    const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: typedResult.summary }],
        isError: false,
        timestamp: Date.now()
    };
    return { toolMessage, typedResult };
}
