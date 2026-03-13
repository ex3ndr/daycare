import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import type { DocumentDbRecord, DocumentReferenceDbRecord } from "../../../storage/databaseTypes.js";
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

type DocumentReadArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        found: Type.Boolean(),
        summary: Type.String(),
        vaultId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type DocumentReadResult = { found: boolean; summary: string; vaultId?: string };

const returns: ToolResultContract<DocumentReadResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the vault_read tool for reading a vault entry by id/path or listing roots.
 * Expects: storage.documents is available for ctx.userId.
 */
export function documentReadToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "vault_read",
            description:
                "Read a vault entry by vaultId or path (vault://a/b). Omit both to list root vault entries. " +
                "When reading vault://memory, includes a full subtree overview.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as DocumentReadArgs;
            const vaultId = payload.vaultId?.trim();
            const path = payload.path?.trim();
            if (vaultId && path) {
                throw new Error("Provide either vaultId or path, not both.");
            }

            if (!vaultId && !path) {
                const summary = await documentRootsSummaryBuild(toolContext.ctx, storage.documents);
                return toolResultBuild(toolCall, { found: true, summary });
            }

            let targetDocumentId: string | null = null;
            if (vaultId) {
                targetDocumentId = vaultId;
            } else if (path === "vault://") {
                const summary = await documentRootsSummaryBuild(toolContext.ctx, storage.documents);
                return toolResultBuild(toolCall, { found: true, summary });
            } else if (path) {
                targetDocumentId = await documentPathFind(toolContext.ctx, path, storage.documents);
                if (!targetDocumentId) {
                    const summary = `Vault entry not found for path: ${path}`;
                    return toolResultBuild(toolCall, { found: false, summary });
                }
            }

            if (!targetDocumentId) {
                const summary = "Vault entry not found.";
                return toolResultBuild(toolCall, { found: false, summary });
            }

            const document = await storage.documents.findById(toolContext.ctx, targetDocumentId);
            if (!document) {
                const summary = `Vault entry not found: ${targetDocumentId}`;
                return toolResultBuild(toolCall, { found: false, summary });
            }
            const chain = await documentChainResolve(toolContext.ctx, document.id, storage.documents);
            if (chain) {
                toolContext.agent.documentChainReadMark(
                    chain.map((entry) => ({ id: entry.id, version: entry.version }))
                );
            }

            const summary = await documentSummaryBuild(toolContext.ctx, storage.documents, document);
            return toolResultBuild(toolCall, { found: true, summary, vaultId: document.id });
        }
    };
}

async function documentRootsSummaryBuild(
    ctx: Parameters<typeof documentPathResolve>[0],
    documents: {
        findRoots: (ctx: Parameters<typeof documentPathResolve>[0]) => Promise<DocumentDbRecord[]>;
    } & Parameters<typeof documentPathResolve>[2]
): Promise<string> {
    const roots = await documents.findRoots(ctx);
    const lines = ["# Root Vault", ""];
    if (roots.length === 0) {
        lines.push("(no root vault entries)");
        return lines.join("\n");
    }

    for (const root of roots) {
        const path = (await documentPathResolve(ctx, root.id, documents)) ?? "(unknown)";
        lines.push(`- **${root.title}** (id: \`${root.id}\`, slug: \`${root.slug}\`)`);
        lines.push(`  - path: \`${path}\``);
        if (root.description) {
            lines.push(`  - ${root.description}`);
        }
    }

    return lines.join("\n");
}

async function documentSummaryBuild(
    ctx: Parameters<typeof documentPathResolve>[0],
    documents: {
        findReferences: (
            ctx: Parameters<typeof documentPathResolve>[0],
            id: string
        ) => Promise<DocumentReferenceDbRecord[]>;
        findChildren: (
            ctx: Parameters<typeof documentPathResolve>[0],
            parentId: string | null
        ) => Promise<DocumentDbRecord[]>;
    } & Parameters<typeof documentPathResolve>[2],
    document: DocumentDbRecord
): Promise<string> {
    const path = (await documentPathResolve(ctx, document.id, documents)) ?? "(unknown)";
    const references = await documents.findReferences(ctx, document.id);
    const children = await documents.findChildren(ctx, document.id);
    const linkRefs = references.filter((ref) => ref.kind !== "parent").map((ref) => ref.targetId);

    const lines = [
        `# ${document.title}`,
        "",
        `- **id**: \`${document.id}\``,
        `- **slug**: \`${document.slug}\``,
        `- **path**: \`${path}\``,
        `- **version**: ${document.version ?? 1}`,
        `- **createdAt**: ${document.createdAt}`,
        `- **updatedAt**: ${document.updatedAt}`,
        `- **description**: ${document.description || "(none)"}`,
        `- **refs**: ${linkRefs.length > 0 ? linkRefs.map((id) => `\`${id}\``).join(", ") : "(none)"}`,
        "",
        "## Children",
        ""
    ];

    if (children.length === 0) {
        lines.push("(none)");
    } else {
        for (const child of children) {
            lines.push(`- **${child.title}** (id: \`${child.id}\`, slug: \`${child.slug}\`)`);
            if (child.description) {
                lines.push(`  - ${child.description}`);
            }
            lines.push(`  - updatedAt=${child.updatedAt}`);
            if (child.body.trim()) {
                lines.push(`  - preview: ${documentPreviewBuild(child.body)}`);
            }
        }
    }

    lines.push("", "## Body", "", document.body);

    if (path === "vault://memory") {
        const subtreeLines = await documentSubtreeSummaryBuild(ctx, document.id, documents);
        lines.push("", "## Memory Tree", "", ...subtreeLines);
    }

    return lines.join("\n");
}

function documentPreviewBuild(body: string): string {
    const normalized = body.replace(/\s+/g, " ").trim();
    if (normalized.length <= 160) {
        return normalized;
    }
    return `${normalized.slice(0, 160)}...`;
}

async function documentSubtreeSummaryBuild(
    ctx: Parameters<typeof documentPathResolve>[0],
    rootId: string,
    documents: {
        findChildren: (
            ctx: Parameters<typeof documentPathResolve>[0],
            parentId: string | null
        ) => Promise<DocumentDbRecord[]>;
    }
): Promise<string[]> {
    const lines: string[] = [];
    const visited = new Set<string>();

    const walk = async (parentId: string, depth: number): Promise<void> => {
        if (visited.has(parentId)) {
            return;
        }
        visited.add(parentId);

        const children = await documents.findChildren(ctx, parentId);
        for (const child of children) {
            const indent = "  ".repeat(depth);
            lines.push(`${indent}- **${child.title}** (id: \`${child.id}\`, slug: \`${child.slug}\`)`);
            lines.push(`${indent}  updatedAt=${child.updatedAt}`);
            if (child.description) {
                lines.push(`${indent}  ${child.description}`);
            }
            if (child.body.trim()) {
                lines.push(`${indent}  > ${documentPreviewBuild(child.body)}`);
            }
            await walk(child.id, depth + 1);
        }
    };

    await walk(rootId, 0);
    if (lines.length === 0) {
        lines.push("(empty subtree)");
    }
    return lines;
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: DocumentReadResult
): { toolMessage: ToolResultMessage; typedResult: DocumentReadResult } {
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
