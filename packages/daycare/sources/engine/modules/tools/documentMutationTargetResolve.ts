import type { Context } from "@/types";
import type { DocumentDbRecord } from "../../../storage/databaseTypes.js";
import { documentPathFind } from "../../../storage/documentPathFind.js";

type DocumentMutationTargetResolveInput = {
    documentId?: string;
    path?: string;
};

type DocumentMutationTargetResolveRepo = {
    findById: (ctx: Context, id: string) => Promise<DocumentDbRecord | null>;
    findBySlugAndParent: (ctx: Context, slug: string, parentId: string | null) => Promise<{ id: string } | null>;
};

/**
 * Resolves a mutation target document from an explicit id or `~/...` path.
 * Expects: exactly one selector is provided and points to an existing document.
 */
export async function documentMutationTargetResolve(
    ctx: Context,
    input: DocumentMutationTargetResolveInput,
    documents: DocumentMutationTargetResolveRepo
): Promise<DocumentDbRecord> {
    const documentId = input.documentId?.trim();
    const path = input.path?.trim();
    if (documentId && path) {
        throw new Error("Provide either documentId or path, not both.");
    }
    if (!documentId && !path) {
        throw new Error("Provide either documentId or path.");
    }

    let targetDocumentId = documentId ?? null;
    if (!targetDocumentId && path) {
        if (path === "~" || path === "~/") {
            throw new Error("Path must point to a document, not the root listing.");
        }
        targetDocumentId = await documentPathFind(ctx, path, documents);
        if (!targetDocumentId) {
            throw new Error(`Document not found for path: ${path}`);
        }
    }
    if (!targetDocumentId) {
        throw new Error("Document target is required.");
    }

    const document = await documents.findById(ctx, targetDocumentId);
    if (!document) {
        throw new Error(`Document not found: ${targetDocumentId}`);
    }

    return document;
}
