import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { documentRootDocumentEnsure } from "../document/documentRootDocumentEnsure.js";
import { documentSystemDocsEnsure } from "../document/documentSystemDocsEnsure.js";
import { memoryRootDocumentEnsure } from "../memory/memoryRootDocumentEnsure.js";
import { peopleRootDocumentEnsure } from "../people/peopleRootDocumentEnsure.js";

/**
 * Ensures the full base document tree exists for a user or workspace without overwriting existing documents.
 * Expects: ctx.userId is valid; optional soulBody is only used when vault://system/soul is missing.
 */
export async function userDocumentsEnsure(
    ctx: Context,
    storage: Pick<Storage, "documents">,
    options?: { soulBody?: string }
): Promise<void> {
    await memoryRootDocumentEnsure(ctx, storage);
    await peopleRootDocumentEnsure(ctx, storage);
    await documentRootDocumentEnsure(ctx, storage);
    await documentSystemDocsEnsure(ctx, storage, options);
}
