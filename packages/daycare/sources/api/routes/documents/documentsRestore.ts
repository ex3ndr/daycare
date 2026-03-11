import type { Context } from "@/types";
import type { DocumentsRepository } from "../../../storage/documentsRepository.js";

export type DocumentsRestoreInput = {
    ctx: Context;
    id: string;
    documents: DocumentsRepository;
};

export type DocumentsRestoreResult =
    | {
          ok: true;
          document: {
              id: string;
              title: string;
              version: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Restores a deleted document by id.
 * Expects: id is non-empty after trimming.
 */
export async function documentsRestore(input: DocumentsRestoreInput): Promise<DocumentsRestoreResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    try {
        const restored = await input.documents.restore(input.ctx, id);
        return {
            ok: true,
            document: {
                id: restored.id,
                title: restored.title,
                version: restored.version ?? 1
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to restore document.";
        return { ok: false, error: message };
    }
}
