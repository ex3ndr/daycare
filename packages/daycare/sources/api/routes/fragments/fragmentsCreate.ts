import type { Context } from "@/types";
import { fragmentSpecIssuesFormat, fragmentSpecValidate } from "../../../fragments/fragmentSpecValidate.js";
import type { FragmentDbRecord } from "../../../storage/databaseTypes.js";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";

export type FragmentsCreateInput = {
    ctx: Context;
    body: Record<string, unknown>;
    fragments: FragmentsRepository;
};

export type FragmentsCreateResult =
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
 * Creates a fragment from request body fields.
 * Expects: body includes id, kitVersion, title, and spec.
 */
export async function fragmentsCreate(input: FragmentsCreateInput): Promise<FragmentsCreateResult> {
    const id = typeof input.body.id === "string" ? input.body.id.trim() : "";
    if (!id) {
        return { ok: false, error: "id is required." };
    }

    const kitVersion = typeof input.body.kitVersion === "string" ? input.body.kitVersion.trim() : "";
    if (!kitVersion) {
        return { ok: false, error: "kitVersion is required." };
    }

    const title = typeof input.body.title === "string" ? input.body.title.trim() : "";
    if (!title) {
        return { ok: false, error: "title is required." };
    }

    if (!Object.hasOwn(input.body, "spec")) {
        return { ok: false, error: "spec is required." };
    }

    const specValidation = fragmentSpecValidate(input.body.spec);
    if (!specValidation.valid) {
        return { ok: false, error: `Invalid spec:\n${fragmentSpecIssuesFormat(specValidation.issues)}` };
    }

    const description = typeof input.body.description === "string" ? input.body.description.trim() : "";
    const now = Date.now();

    try {
        const record = await input.fragments.create(input.ctx, {
            id,
            kitVersion,
            title,
            description,
            spec: input.body.spec,
            createdAt: now,
            updatedAt: now
        });
        return {
            ok: true,
            fragment: fragmentPublicBuild(record)
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create fragment.";
        return { ok: false, error: message };
    }
}

function fragmentPublicBuild(record: FragmentDbRecord): Exclude<FragmentsCreateResult, { ok: false }>["fragment"] {
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
