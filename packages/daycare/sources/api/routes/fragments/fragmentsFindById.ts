import type { Context } from "@/types";
import type { FragmentDbRecord } from "../../../storage/databaseTypes.js";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";

export type FragmentsFindByIdInput = {
    ctx: Context;
    id: string;
    fragments: FragmentsRepository;
};

export type FragmentsFindByIdResult =
    | {
          ok: true;
          fragment: {
              id: string;
              kitVersion: string;
              title: string;
              description: string;
              spec: unknown;
              archived: boolean;
              version: number;
              createdAt: number;
              updatedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Loads a fragment by id, including archived rows for direct reference rendering.
 * Expects: id is non-empty after trimming.
 */
export async function fragmentsFindById(input: FragmentsFindByIdInput): Promise<FragmentsFindByIdResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    const record = await input.fragments.findAnyById(input.ctx, id);
    if (!record) {
        return { ok: false, error: "Fragment not found." };
    }

    return {
        ok: true,
        fragment: fragmentPublicBuild(record)
    };
}

function fragmentPublicBuild(record: FragmentDbRecord): Exclude<FragmentsFindByIdResult, { ok: false }>["fragment"] {
    return {
        id: record.id,
        kitVersion: record.kitVersion,
        title: record.title,
        description: record.description,
        spec: record.spec,
        archived: record.archived,
        version: record.version ?? 1,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}
