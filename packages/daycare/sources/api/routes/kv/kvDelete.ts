import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";

export type KvDeleteInput = {
    ctx: Context;
    key: string;
    keyValues: KeyValuesRepository;
};

export type KvDeleteResult =
    | {
          ok: true;
          deleted: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Deletes a key-value entry by key.
 * Expects: key is non-empty after trimming.
 */
export async function kvDelete(input: KvDeleteInput): Promise<KvDeleteResult> {
    const key = input.key.trim();
    if (!key) {
        return { ok: false, error: "key is required." };
    }
    const deleted = await input.keyValues.delete(input.ctx, key);
    if (!deleted) {
        return { ok: false, error: "Entry not found." };
    }
    return { ok: true, deleted: true };
}
