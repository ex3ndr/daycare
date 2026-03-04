import type { Context } from "@/types";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";

export type FragmentsArchiveInput = {
    ctx: Context;
    id: string;
    fragments: FragmentsRepository;
};

export type FragmentsArchiveResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Archives a fragment by id.
 * Expects: id is non-empty after trimming.
 */
export async function fragmentsArchive(input: FragmentsArchiveInput): Promise<FragmentsArchiveResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    try {
        await input.fragments.archive(input.ctx, id);
        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to archive fragment.";
        return { ok: false, error: message };
    }
}
