import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";

export type KvReadInput = {
    ctx: Context;
    key: string;
    keyValues: KeyValuesRepository;
};

export type KvReadResult =
    | {
          ok: true;
          entry: {
              key: string;
              value: unknown;
              createdAt: number;
              updatedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Reads one key-value entry by key for the authenticated user.
 * Expects: key is non-empty after trimming.
 */
export async function kvRead(input: KvReadInput): Promise<KvReadResult> {
    const key = input.key.trim();
    if (!key) {
        return { ok: false, error: "key is required." };
    }

    const entry = await input.keyValues.findByKey(input.ctx, key);
    if (!entry) {
        return { ok: false, error: "Entry not found." };
    }

    return {
        ok: true,
        entry: {
            key: entry.key,
            value: entry.value,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }
    };
}
