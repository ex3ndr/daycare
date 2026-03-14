import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { vaultRootVaultEnsure } from "../document/vaultRootVaultEnsure.js";
import { vaultSystemDocsEnsure } from "../document/vaultSystemDocsEnsure.js";
import { memoryRootVaultEnsure } from "../memory/memoryRootVaultEnsure.js";
import { peopleRootVaultEnsure } from "../people/peopleRootVaultEnsure.js";

/**
 * Ensures the full base document tree exists for a user or workspace without overwriting existing documents.
 * Expects: ctx.userId is valid; optional soulBody is only used when vault://system/soul is missing.
 */
export async function userDocumentsEnsure(
    ctx: Context,
    storage: Pick<Storage, "documents">,
    options?: { soulBody?: string }
): Promise<void> {
    await memoryRootVaultEnsure(ctx, storage);
    await peopleRootVaultEnsure(ctx, storage);
    await vaultRootVaultEnsure(ctx, storage);
    await vaultSystemDocsEnsure(ctx, storage, options);
}
