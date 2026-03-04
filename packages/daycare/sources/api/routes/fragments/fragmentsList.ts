import type { Context } from "@/types";
import type { FragmentDbRecord } from "../../../storage/databaseTypes.js";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";

export type FragmentsListInput = {
    ctx: Context;
    fragments: FragmentsRepository;
};

export type FragmentsListResult = {
    ok: true;
    fragments: Array<{
        id: string;
        kitVersion: string;
        title: string;
        description: string;
        spec: unknown;
        archived: boolean;
        version: number;
        createdAt: number;
        updatedAt: number;
    }>;
};

/**
 * Lists active non-archived fragments for the authenticated user.
 * Expects: fragments repository is initialized and scoped by ctx.userId.
 */
export async function fragmentsList(input: FragmentsListInput): Promise<FragmentsListResult> {
    const records = await input.fragments.findAll(input.ctx);
    return {
        ok: true,
        fragments: records.map((record) => fragmentPublicBuild(record))
    };
}

function fragmentPublicBuild(record: FragmentDbRecord): FragmentsListResult["fragments"][number] {
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
