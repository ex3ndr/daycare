import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";

export type KvListInput = {
    ctx: Context;
    keyValues: KeyValuesRepository;
};

export type KvListResult = {
    ok: true;
    entries: Array<{
        key: string;
        value: unknown;
        createdAt: number;
        updatedAt: number;
    }>;
};

/**
 * Lists key-value entries for the authenticated user.
 * Expects: keyValues repository is initialized.
 */
export async function kvList(input: KvListInput): Promise<KvListResult> {
    const entries = await input.keyValues.findMany(input.ctx);
    return {
        ok: true,
        entries: entries.map((entry) => ({
            key: entry.key,
            value: entry.value,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }))
    };
}
