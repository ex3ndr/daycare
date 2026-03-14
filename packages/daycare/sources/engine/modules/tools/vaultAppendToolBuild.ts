import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { peopleVaultFrontmatterAssert } from "../../people/peopleVaultFrontmatterAssert.js";
import { vaultMutationMemoryScopeAssert } from "./vaultMutationMemoryScopeAssert.js";
import { vaultMutationTargetResolve } from "./vaultMutationTargetResolve.js";

const schema = Type.Object(
    {
        vaultId: Type.Optional(Type.String({ minLength: 1 })),
        path: Type.Optional(Type.String({ minLength: 1 })),
        text: Type.String({
            minLength: 1,
            description: "Text to append exactly to the end of the existing vault entry body."
        })
    },
    { additionalProperties: false }
);

type VaultAppendArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        vaultId: Type.String(),
        version: Type.Number()
    },
    { additionalProperties: false }
);

type VaultAppendResult = Static<typeof resultSchema>;

const returns: ToolResultContract<VaultAppendResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Builds the vault_append tool that appends text to an existing vault entry body.
 * Expects: exactly one selector (`vaultId` or `path`) and non-empty append text.
 */
export function vaultAppendToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "vault_append",
            description:
                "Append text to the end of an existing vault entry body. " +
                "Provide exactly one selector: vaultId or path (vault://a/b).",
            parameters: schema
        },
        returns,
        execute: async (args, toolContext, toolCall) => {
            const storage = toolContext.storage ?? toolContext.agentSystem.storage;
            if (!storage) {
                throw new Error("Storage is not available.");
            }

            const payload = args as VaultAppendArgs;
            const document = await vaultMutationTargetResolve(toolContext.ctx, payload, storage.documents);
            await vaultMutationMemoryScopeAssert(toolContext, storage.documents, document.id);

            const nextBody = `${document.body}${payload.text}`;
            await peopleVaultFrontmatterAssert({
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
            const summary = `Appended text to vault entry: ${document.id} (version ${version}).`;
            return toolResultBuild(toolCall, {
                summary,
                vaultId: document.id,
                version
            });
        }
    };
}

function toolResultBuild(
    toolCall: { id: string; name: string },
    typedResult: VaultAppendResult
): { toolMessage: ToolResultMessage; typedResult: VaultAppendResult } {
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
