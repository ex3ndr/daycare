import type { Context } from "@/types";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";

export type FragmentsRestoreInput = {
    ctx: Context;
    id: string;
    fragments: FragmentsRepository;
};

export type FragmentsRestoreResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Restores an archived fragment by id.
 * Expects: id is non-empty after trimming.
 */
export async function fragmentsRestore(input: FragmentsRestoreInput): Promise<FragmentsRestoreResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    try {
        await input.fragments.unarchive(input.ctx, id);
        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to restore fragment.";
        return { ok: false, error: message };
    }
}
