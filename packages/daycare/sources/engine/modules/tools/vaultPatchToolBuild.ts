import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { peopleVaultFrontmatterAssert } from "../../people/peopleVaultFrontmatterAssert.js";
import { vaultMutationMemoryScopeAssert } from "./vaultMutationMemoryScopeAssert.js";
import { vaultMutationTargetResolve } from "./vaultMutationTargetResolve.js";

const patchSchema = Type.Object(
    {
        search: Type.String({ minLength: 1 }),
        replace: Type.String(),
        replaceAll: Type.Optional(
            Type.Boolean({
                description: "When true, replace every exact match of search. Otherwise exactly one match is required."
            })
        )
    },
    { additionalProperties: false }
);

const schema = Type.Object(
    {
        vaultId: Type.Optional(Type.String({ minLength: 1 })),
        path: Type.Optional(Type.String({ minLength: 1 })),
        patch: patchSchema
    },
    { additionalProperties: false }
);

type VaultPatchArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        vaultId: Type.String(),
        version: Type.Number(),
        replacedCount: Type.Number(),
        matchCount: Type.Number()
    },
    { additionalProperties: false }
);

type VaultPatchResult = Static<typeof resultSchema>;

const returns: ToolResultContract<VaultPatchResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the vault_patch tool that applies exact-text patch replacement to body.
 * Expects: one vault selector and a patch object with `search` and `replace`.
 */
export function vaultPatchToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "vault_patch",
            description:
                "Apply an exact-text patch to a vault entry body. " +
                "Patch format: { search, replace, replaceAll? }. " +
                "By default, search must match exactly once.",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as VaultPatchArgs;
            const document = await vaultMutationTargetResolve(toolContext.ctx, payload, storage.documents);
            await vaultMutationMemoryScopeAssert(toolContext, storage.documents, document.id);

            const patched = vaultPatchApply(document.body, payload.patch);
            await peopleVaultFrontmatterAssert({
                ctx: toolContext.ctx,
                documents: storage.documents,
                parentId: await storage.documents.findParentId(toolContext.ctx, document.id),
                body: patched.body
            });

            const updated = await storage.documents.update(toolContext.ctx, document.id, {
                body: patched.body,
                updatedAt: Date.now()
            });
            const version = updated.version ?? 1;
            const summary = `Patched vault entry: ${document.id} (version ${version}, replaced ${patched.replacedCount} match(es)).`;
            return toolResultBuild(toolCall, {
                summary,
                vaultId: document.id,
                version,
                replacedCount: patched.replacedCount,
                matchCount: patched.matchCount
            });
        }
    };
}

function vaultPatchApply(
    body: string,
    patch: {
        search: string;
        replace: string;
        replaceAll?: boolean;
    }
): { body: string; matchCount: number; replacedCount: number } {
    const matchCount = vaultMatchCount(body, patch.search);
    if (matchCount === 0) {
        throw new Error("Patch search text was not found in vault entry body.");
    }
    if (patch.replaceAll === true) {
        return {
            body: body.split(patch.search).join(patch.replace),
            matchCount,
            replacedCount: matchCount
        };
    }
    if (matchCount > 1) {
        throw new Error(
            `Patch search text matched ${matchCount} locations. Use replaceAll=true or provide a more specific search string.`
        );
    }

    const firstIndex = body.indexOf(patch.search);
    const nextBody = `${body.slice(0, firstIndex)}${patch.replace}${body.slice(firstIndex + patch.search.length)}`;
    return {
        body: nextBody,
        matchCount,
        replacedCount: 1
    };
}

function vaultMatchCount(body: string, search: string): number {
    let count = 0;
    let cursor = 0;
    while (true) {
        const index = body.indexOf(search, cursor);
        if (index === -1) {
            break;
        }
        count++;
        cursor = index + search.length;
    }
    return count;
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: VaultPatchResult
): { toolMessage: ToolResultMessage; typedResult: VaultPatchResult } {
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
