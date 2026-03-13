import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { DocumentDbRecord } from "../../../storage/databaseTypes.js";
import { documentChainResolve } from "../../../storage/documentChainResolve.js";
import { documentPathFind } from "../../../storage/documentPathFind.js";
import { documentPathResolve } from "../../../storage/documentPathResolve.js";

const schema = Type.Object(
    {
        vaultId: Type.Optional(Type.String({ minLength: 1 })),
        path: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type DocumentTreeArgs = Static<typeof schema>;

const documentTreeEntrySchema = Type.Object(
    {
        vaultId: Type.String(),
        parentVaultId: Type.Optional(Type.String()),
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
        rootVaultId: Type.Optional(Type.String()),
        entries: Type.Array(documentTreeEntrySchema)
    },
    { additionalProperties: false }
);

type DocumentTreeResult = {
    found: boolean;
    summary: string;
    rootVaultId?: string;
    entries: DocumentTreeEntry[];
};

const returns: ToolResultContract<DocumentTreeResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the vault_tree tool for structured vault traversal.
 * Expects: storage.documents is available for ctx.userId.
 */
export function documentTreeToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "vault_tree",
            description:
                "Return a structured vault tree by vaultId or path (vault://a/b). " +
                "Omit both to return all root vault trees.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentTreeArgs;
            const vaultId = payload.vaultId?.trim();
            const path = payload.path?.trim();
            if (vaultId && path) {
                throw new Error("Provide either vaultId or path, not both.");
            }

            if (!vaultId && !path) {
                const roots = await storage.documents.findRoots(toolContext.ctx);
                const entries = await documentTreeEntriesBuild(toolContext.ctx, roots, storage.documents);
                return toolResultBuild(toolCall, {
                    found: true,
                    summary: documentTreeSummaryBuild(entries, undefined),
                    entries
                });
            }

            let targetDocumentId: string | null = null;
            if (vaultId) {
                targetDocumentId = vaultId;
            } else if (path === "vault://") {
                const roots = await storage.documents.findRoots(toolContext.ctx);
                const entries = await documentTreeEntriesBuild(toolContext.ctx, roots, storage.documents);
                return toolResultBuild(toolCall, {
                    found: true,
                    summary: documentTreeSummaryBuild(entries, undefined),
                    entries
                });
            } else if (path) {
                targetDocumentId = await documentPathFind(toolContext.ctx, path, storage.documents);
                if (!targetDocumentId) {
                    const summary = `Vault entry not found for path: ${path}`;
                    return toolResultBuild(toolCall, { found: false, summary, entries: [] });
                }
            }

            if (!targetDocumentId) {
                return toolResultBuild(toolCall, { found: false, summary: "Vault entry not found.", entries: [] });
            }

            const document = await storage.documents.findById(toolContext.ctx, targetDocumentId);
            if (!document) {
                return toolResultBuild(toolCall, {
                    found: false,
                    summary: `Vault entry not found: ${targetDocumentId}`,
                    entries: []
                });
            }

            const chain = await documentChainResolve(toolContext.ctx, document.id, storage.documents);
            if (chain) {
                toolContext.agent.documentChainReadMark(
                    chain.map((entry) => ({ id: entry.id, version: entry.version }))
                );
            }

            const entries = await documentTreeEntriesBuild(toolContext.ctx, [document], storage.documents);
            return toolResultBuild(toolCall, {
                found: true,
                summary: documentTreeSummaryBuild(entries, document.id),
                rootVaultId: document.id,
                entries
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

    const walk = async (document: DocumentDbRecord, depth: number, parentVaultId?: string): Promise<void> => {
        if (visited.has(document.id)) {
            return;
        }
        visited.add(document.id);
        const path = (await documentPathResolve(ctx, document.id, documents)) ?? "(unknown)";
        result.push({
            vaultId: document.id,
            parentVaultId,
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

function documentTreeSummaryBuild(entries: DocumentTreeEntry[], rootVaultId?: string): string {
    const lines = [
        rootVaultId ? "# Vault Tree" : "# Root Vault Trees",
        "",
        `- entries: ${entries.length}`,
        ...(rootVaultId ? [`- rootVaultId: \`${rootVaultId}\``] : []),
        "",
        "## Entries",
        ""
    ];

    if (entries.length === 0) {
        lines.push("(empty)");
        return lines.join("\n");
    }

    for (const document of entries) {
        const indent = "  ".repeat(document.depth);
        lines.push(
            `${indent}- **${document.title}** (id: \`${document.vaultId}\`, slug: \`${document.slug}\`, updatedAt=${document.updatedAt})`
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
