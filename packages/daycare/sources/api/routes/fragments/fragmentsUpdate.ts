import type { Context } from "@/types";
import { fragmentSpecIssuesFormat, fragmentSpecValidate } from "../../../fragments/fragmentSpecValidate.js";
import type { FragmentDbRecord } from "../../../storage/databaseTypes.js";
import type { FragmentsRepository, FragmentUpdateInput } from "../../../storage/fragmentsRepository.js";

export type FragmentsUpdateInput = {
    ctx: Context;
    id: string;
    body: Record<string, unknown>;
    fragments: FragmentsRepository;
};

export type FragmentsUpdateResult =
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
 * Updates an existing fragment with a partial set of fields.
 * Expects: id is non-empty and body includes at least one updatable field.
 */
export async function fragmentsUpdate(input: FragmentsUpdateInput): Promise<FragmentsUpdateResult> {
    const id = input.id.trim();
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    const changes: FragmentUpdateInput = {};
    if (Object.hasOwn(input.body, "kitVersion")) {
        if (typeof input.body.kitVersion !== "string") {
            return { ok: false, error: "kitVersion must be a string." };
        }
        const kitVersion = input.body.kitVersion.trim();
        if (!kitVersion) {
            return { ok: false, error: "kitVersion must be a non-empty string." };
        }
        changes.kitVersion = kitVersion;
    }

    if (Object.hasOwn(input.body, "title")) {
        if (typeof input.body.title !== "string") {
            return { ok: false, error: "title must be a string." };
        }
        const title = input.body.title.trim();
        if (!title) {
            return { ok: false, error: "title must be a non-empty string." };
        }
        changes.title = title;
    }

    if (Object.hasOwn(input.body, "description")) {
        if (typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string." };
        }
        changes.description = input.body.description.trim();
    }

    if (Object.hasOwn(input.body, "spec")) {
        const specValidation = fragmentSpecValidate(input.body.spec);
        if (!specValidation.valid) {
            return { ok: false, error: `Invalid spec:\n${fragmentSpecIssuesFormat(specValidation.issues)}` };
        }
        changes.spec = input.body.spec;
    }

    if (Object.keys(changes).length === 0) {
        return { ok: false, error: "At least one field is required: kitVersion, title, description, or spec." };
    }

    try {
        const record = await input.fragments.update(input.ctx, id, changes);
        return {
            ok: true,
            fragment: fragmentPublicBuild(record)
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update fragment.";
        return { ok: false, error: message };
    }
}

function fragmentPublicBuild(record: FragmentDbRecord): Exclude<FragmentsUpdateResult, { ok: false }>["fragment"] {
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
