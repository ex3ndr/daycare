import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionContext, ToolResultContract } from "@/types";
import { vaultChainResolve } from "../../../storage/vaultChainResolve.js";
import { vaultPathFind } from "../../../storage/vaultPathFind.js";
import { vaultPathResolve } from "../../../storage/vaultPathResolve.js";
import { vaultSlugNormalize } from "../../../storage/vaultSlugNormalize.js";
import { peopleVaultFrontmatterAssert } from "../../people/peopleVaultFrontmatterAssert.js";
import { vaultMutationMemoryPathAllowed } from "./vaultMutationMemoryPathAllowed.js";
import { vaultMutationMemoryPromptSlugsResolve } from "./vaultMutationMemoryPromptSlugsResolve.js";

const schema = Type.Object(
    {
        vaultId: Type.Optional(Type.String({ minLength: 1 })),
        slug: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        body: Type.String(),
        parentId: Type.Optional(Type.String({ minLength: 1 })),
        parentPath: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
);

type VaultWriteArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        vaultId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type VaultWriteResult = { summary: string; vaultId: string; version: number };

const returns: ToolResultContract<VaultWriteResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};
/**
 * Builds the vault_write tool that creates or updates a vault entry.
 * Expects: storage.documents is available and scoped by ctx.userId.
 */
export function vaultWriteToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "vault_write",
            description:
                "Create or update a vault entry. Omit vaultId to create. " +
                "Provide parentId or parentPath (vault://a/b) to place the vault entry in the tree. " +
                "When setting a parent, first call vault_read for the full parent chain in this session.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as VaultWriteArgs;
            const slug = vaultSlugNormalize(payload.slug);
            const title = payload.title.trim();
            if (!title) {
                throw new Error("Vault entry title is required.");
            }
            const description = payload.description.trim();
            if (!description) {
                throw new Error("Vault entry description is required.");
            }

            const parentIdFromPath = await parentIdFromPathResolve(
                toolContext.ctx,
                payload.parentPath,
                storage.documents
            );
            const parentIdFromArgs = payload.parentId?.trim();
            if (parentIdFromArgs && parentIdFromPath !== undefined && parentIdFromPath !== parentIdFromArgs) {
                throw new Error("parentId and parentPath resolved to different vault entries.");
            }

            const parentId = parentIdFromPath !== undefined ? parentIdFromPath : parentIdFromArgs;
            const vaultId = payload.vaultId?.trim();
            if (toolContext.agent.config.kind === "memory" || toolContext.agent.config.kind === "compactor") {
                await memoryAgentVaultTreeWriteAssert(
                    toolContext,
                    storage.documents,
                    vaultId,
                    slug,
                    parentIdFromPath,
                    parentIdFromArgs
                );
            }
            if (parentId) {
                await parentChainReadAssert(toolContext, storage.documents, parentId);
            }
            await peopleVaultFrontmatterAssert({
                ctx: toolContext.ctx,
                documents: storage.documents,
                parentId: parentId ?? null,
                body: payload.body
            });
            const now = Date.now();

            if (vaultId) {
                const updated = await storage.documents.update(toolContext.ctx, vaultId, {
                    slug,
                    title,
                    description,
                    body: payload.body,
                    updatedAt: now,
                    ...(parentIdFromPath !== undefined || parentIdFromArgs !== undefined
                        ? { parentId: parentId ?? null }
                        : {})
                });
                const summary = `Updated vault entry: ${vaultId} (version ${updated.version ?? 1}).`;
                return toolResultBuild(toolCall, {
                    summary,
                    vaultId,
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
            const summary = `Created vault entry: ${created.id} (version ${created.version ?? 1}).`;
            return toolResultBuild(toolCall, {
                summary,
                vaultId: created.id,
                version: created.version ?? 1
            });
        }
    };
}

async function parentIdFromPathResolve(
    ctx: ToolExecutionContext["ctx"],
    parentPath: string | undefined,
    documents: {
        findBySlugAndParent: (
            ctx: ToolExecutionContext["ctx"],
            slug: string,
            parentId: string | null
        ) => Promise<{ id: string } | null>;
    }
): Promise<string | null | undefined> {
    const normalized = parentPath?.trim();
    if (normalized === undefined) {
        return undefined;
    }
    if (!normalized || normalized === "vault://" || normalized === "doc://") {
        return null;
    }

    const parentId = await vaultPathFind(ctx, normalized, documents);
    if (!parentId) {
        throw new Error(`Parent path not found: ${normalized}`);
    }
    return parentId;
}

async function parentChainReadAssert(
    toolContext: ToolExecutionContext,
    documents: {
        findById: (
            ctx: ToolExecutionContext["ctx"],
            id: string
        ) => Promise<{
            id: string;
            slug: string;
            version?: number | null;
        } | null>;
        findParentId: (ctx: ToolExecutionContext["ctx"], id: string) => Promise<string | null>;
    },
    parentId: string
): Promise<void> {
    const chain = await vaultChainResolve(toolContext.ctx, parentId, documents);
    if (!chain || chain.length === 0) {
        throw new Error(`Parent vault entry not found: ${parentId}`);
    }
    for (let index = 0; index < chain.length; index++) {
        const entry = chain[index];
        if (!entry) {
            continue;
        }
        const path = (await vaultPathResolve(toolContext.ctx, entry.id, documents)) ?? `vault-id:${entry.id}`;
        const readVersion = toolContext.agent.vaultVersionLastRead(entry.id);
        if (readVersion == null) {
            throw new Error(`Parent vault chain must be read before attach. Missing read: ${path}`);
        }
        if (readVersion !== entry.version) {
            throw new Error(
                `Parent vault chain changed since last read: ${path} was version ${readVersion}, current is version ${entry.version}.`
            );
        }
    }
}

async function memoryAgentVaultTreeWriteAssert(
    toolContext: ToolExecutionContext,
    documents: {
        findById: (
            ctx: ToolExecutionContext["ctx"],
            id: string
        ) => Promise<{
            id: string;
            slug: string;
            version?: number | null;
        } | null>;
        findParentId: (ctx: ToolExecutionContext["ctx"], id: string) => Promise<string | null>;
    },
    vaultId: string | undefined,
    slug: string,
    parentIdFromPath: string | null | undefined,
    parentIdFromArgs: string | undefined
): Promise<void> {
    const parentId = await writeParentIdResolve(
        toolContext.ctx,
        documents,
        vaultId,
        parentIdFromPath,
        parentIdFromArgs
    );
    if (parentId === null) {
        if (slug !== "memory") {
            throw new Error(
                "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
            );
        }
        return;
    }

    const chain = await vaultChainResolve(toolContext.ctx, parentId, documents);
    if (!chain || chain.length === 0) {
        throw new Error(`Parent vault entry not found: ${parentId}`);
    }
    if (vaultMutationMemoryPathAllowed(chain, vaultMutationMemoryPromptSlugsResolve(toolContext))) {
        return;
    }
    const root = chain[0];
    const memory = chain[1];
    if (
        root?.slug === "system" &&
        memory?.slug === "memory" &&
        vaultMutationMemoryPromptSlugsResolve(toolContext).has(slug)
    ) {
        return;
    }
    throw new Error(
        "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
    );
}

async function writeParentIdResolve(
    ctx: ToolExecutionContext["ctx"],
    documents: {
        findParentId: (ctx: ToolExecutionContext["ctx"], id: string) => Promise<string | null>;
    },
    vaultId: string | undefined,
    parentIdFromPath: string | null | undefined,
    parentIdFromArgs: string | undefined
): Promise<string | null> {
    if (parentIdFromPath !== undefined) {
        return parentIdFromPath;
    }
    if (parentIdFromArgs !== undefined) {
        return parentIdFromArgs;
    }
    if (!vaultId) {
        return null;
    }
    return documents.findParentId(ctx, vaultId);
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: VaultWriteResult
): { toolMessage: ToolResultMessage; typedResult: VaultWriteResult } {
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
