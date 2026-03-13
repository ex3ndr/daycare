import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { DocumentDbRecord } from "../../../storage/databaseTypes.js";
import { documentChainResolve } from "../../../storage/documentChainResolve.js";
import { documentPathFind } from "../../../storage/documentPathFind.js";
import { documentPathResolve } from "../../../storage/documentPathResolve.js";

const schema = Type.Object(
    {
        documentId: Type.Optional(Type.String({ minLength: 1 })),
        path: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type DocumentTreeArgs = Static<typeof schema>;

const documentTreeEntrySchema = Type.Object(
    {
        documentId: Type.String(),
        parentDocumentId: Type.Union([Type.String(), Type.Null()]),
        title: Type.String(),
        slug: Type.String(),
        path: Type.String(),
        updatedAt: Type.Integer(),
        depth: Type.Integer()
    },
    { additionalProperties: false }
);

type DocumentTreeEntry = Static<typeof documentTreeEntrySchema>;

const resultSchema = Type.Object(
    {
        found: Type.Boolean(),
        summary: Type.String(),
        rootDocumentId: Type.Optional(Type.String()),
        documents: Type.Array(documentTreeEntrySchema)
    },
    { additionalProperties: false }
);

type DocumentTreeResult = {
    found: boolean;
    summary: string;
    rootDocumentId?: string;
    documents: DocumentTreeEntry[];
};

const returns: ToolResultContract<DocumentTreeResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the document_tree tool for structured subtree traversal.
 * Expects: storage.documents is available for ctx.userId.
 */
export function documentTreeToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "document_tree",
            description:
                "Return a structured document tree by documentId or path (doc://a/b). " +
                "Omit both to return all root document trees.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentTreeArgs;
            const documentId = payload.documentId?.trim();
            const path = payload.path?.trim();
            if (documentId && path) {
                throw new Error("Provide either documentId or path, not both.");
            }

            if (!documentId && !path) {
                const roots = await storage.documents.findRoots(toolContext.ctx);
                const documents = await documentTreeEntriesBuild(toolContext.ctx, roots, storage.documents);
                return toolResultBuild(toolCall, {
                    found: true,
                    summary: documentTreeSummaryBuild(documents, undefined),
                    documents
                });
            }

            let targetDocumentId: string | null = null;
            if (documentId) {
                targetDocumentId = documentId;
            } else if (path === "doc://") {
                const roots = await storage.documents.findRoots(toolContext.ctx);
                const documents = await documentTreeEntriesBuild(toolContext.ctx, roots, storage.documents);
                return toolResultBuild(toolCall, {
                    found: true,
                    summary: documentTreeSummaryBuild(documents, undefined),
                    documents
                });
            } else if (path) {
                targetDocumentId = await documentPathFind(toolContext.ctx, path, storage.documents);
                if (!targetDocumentId) {
                    const summary = `Document not found for path: ${path}`;
                    return toolResultBuild(toolCall, { found: false, summary, documents: [] });
                }
            }

            if (!targetDocumentId) {
                return toolResultBuild(toolCall, { found: false, summary: "Document not found.", documents: [] });
            }

            const document = await storage.documents.findById(toolContext.ctx, targetDocumentId);
            if (!document) {
                return toolResultBuild(toolCall, {
                    found: false,
                    summary: `Document not found: ${targetDocumentId}`,
                    documents: []
                });
            }

            const chain = await documentChainResolve(toolContext.ctx, document.id, storage.documents);
            if (chain) {
                toolContext.agent.documentChainReadMark(
                    chain.map((entry) => ({ id: entry.id, version: entry.version }))
                );
            }

            const documents = await documentTreeEntriesBuild(toolContext.ctx, [document], storage.documents);
            return toolResultBuild(toolCall, {
                found: true,
                summary: documentTreeSummaryBuild(documents, document.id),
                rootDocumentId: document.id,
                documents
            });
        }
    };
}

async function documentTreeEntriesBuild(
    ctx: Parameters<typeof documentPathResolve>[0],
    roots: DocumentDbRecord[],
    documents: {
        findChildren: (
            ctx: Parameters<typeof documentPathResolve>[0],
            parentId: string | null
        ) => Promise<DocumentDbRecord[]>;
    } & Parameters<typeof documentPathResolve>[2]
): Promise<DocumentTreeEntry[]> {
    const result: DocumentTreeEntry[] = [];
    const visited = new Set<string>();

    const walk = async (document: DocumentDbRecord, depth: number, parentDocumentId?: string): Promise<void> => {
        if (visited.has(document.id)) {
            return;
        }
        visited.add(document.id);
        const path = (await documentPathResolve(ctx, document.id, documents)) ?? "(unknown)";
        result.push({
            documentId: document.id,
            parentDocumentId: parentDocumentId ?? null,
            title: document.title,
            slug: document.slug,
            path,
            updatedAt: document.updatedAt,
            depth
        });

        const children = await documents.findChildren(ctx, document.id);
        for (const child of children) {
            await walk(child, depth + 1, document.id);
        }
    };

    for (const root of roots) {
        await walk(root, 0);
    }

    return result;
}

function documentTreeSummaryBuild(documents: DocumentTreeEntry[], rootDocumentId?: string): string {
    const lines = [
        rootDocumentId ? "# Document Tree" : "# Root Document Trees",
        "",
        `- documents: ${documents.length}`,
        ...(rootDocumentId ? [`- rootDocumentId: \`${rootDocumentId}\``] : []),
        "",
        "## Entries",
        ""
    ];

    if (documents.length === 0) {
        lines.push("(empty)");
        return lines.join("\n");
    }

    for (const document of documents) {
        const indent = "  ".repeat(document.depth);
        lines.push(
            `${indent}- **${document.title}** (id: \`${document.documentId}\`, slug: \`${document.slug}\`, updatedAt=${document.updatedAt})`
        );
        lines.push(`${indent}  path: \`${document.path}\``);
    }

    return lines.join("\n");
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: DocumentTreeResult
): { toolMessage: ToolResultMessage; typedResult: DocumentTreeResult } {
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
