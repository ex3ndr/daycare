import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { documentPathFind } from "../../../storage/documentPathFind.js";

const schema = Type.Object(
    {
        documentId: Type.Optional(Type.String({ minLength: 1 })),
        slug: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        body: Type.String(),
        parentId: Type.Optional(Type.String({ minLength: 1 })),
        parentPath: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type DocumentWriteArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        documentId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type DocumentWriteResult = { summary: string; documentId: string; version: number };

const returns: ToolResultContract<DocumentWriteResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the document_write tool that creates or updates a document row.
 * Expects: storage.documents is available and scoped by ctx.userId.
 */
export function documentWriteToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "document_write",
            description:
                "Create or update a document. Omit documentId to create. " +
                "Provide parentId or parentPath (~/a/b) to place the document in the tree.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentWriteArgs;
            const slug = payload.slug.trim();
            if (!slug) {
                throw new Error("Document slug is required.");
            }
            const title = payload.title.trim();
            if (!title) {
                throw new Error("Document title is required.");
            }
            const description = payload.description.trim();
            if (!description) {
                throw new Error("Document description is required.");
            }

            const parentIdFromPath = await parentIdFromPathResolve(
                toolContext.ctx,
                payload.parentPath,
                storage.documents
            );
            const parentIdFromArgs = payload.parentId?.trim();
            if (parentIdFromArgs && parentIdFromPath !== undefined && parentIdFromPath !== parentIdFromArgs) {
                throw new Error("parentId and parentPath resolved to different parent documents.");
            }

            const parentId = parentIdFromPath !== undefined ? parentIdFromPath : parentIdFromArgs;
            const now = Date.now();
            const documentId = payload.documentId?.trim();

            if (documentId) {
                const updated = await storage.documents.update(toolContext.ctx, documentId, {
                    slug,
                    title,
                    description,
                    body: payload.body,
                    updatedAt: now,
                    ...(parentIdFromPath !== undefined || parentIdFromArgs !== undefined
                        ? { parentId: parentId ?? null }
                        : {})
                });
                const summary = `Updated document: ${documentId} (version ${updated.version ?? 1}).`;
                return toolResultBuild(toolCall, {
                    summary,
                    documentId,
                    version: updated.version ?? 1
                });
            }

            const createdId = createId();
            const created = await storage.documents.create(toolContext.ctx, {
                id: createdId,
                slug,
                title,
                description,
                body: payload.body,
                createdAt: now,
                updatedAt: now,
                parentId: parentId ?? null
            });
            const summary = `Created document: ${created.id} (version ${created.version ?? 1}).`;
            return toolResultBuild(toolCall, {
                summary,
                documentId: created.id,
                version: created.version ?? 1
            });
        }
    };
}

async function parentIdFromPathResolve(
    ctx: { userId: string; agentId: string },
    parentPath: string | undefined,
    documents: {
        findBySlugAndParent: (
            ctx: { userId: string; agentId: string },
            slug: string,
            parentId: string | null
        ) => Promise<{ id: string } | null>;
    }
): Promise<string | null | undefined> {
    const normalized = parentPath?.trim();
    if (normalized === undefined) {
        return undefined;
    }
    if (!normalized || normalized === "~" || normalized === "~/") {
        return null;
    }

    const parentId = await documentPathFind(ctx, normalized, documents);
    if (!parentId) {
        throw new Error(`Parent path not found: ${normalized}`);
    }
    return parentId;
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: DocumentWriteResult
): { toolMessage: ToolResultMessage; typedResult: DocumentWriteResult } {
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
