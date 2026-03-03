import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";

export type KvUpdateInput = {
    ctx: Context;
    key: string;
    body: Record<string, unknown>;
    keyValues: KeyValuesRepository;
};

export type KvUpdateResult =
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
 * Updates an existing key-value entry by route key.
 * Expects: key exists and body includes value.
 */
export async function kvUpdate(input: KvUpdateInput): Promise<KvUpdateResult> {
    const key = input.key.trim();
    if (!key) {
        return { ok: false, error: "key is required." };
    }

    if (input.body.key !== undefined) {
        if (typeof input.body.key !== "string") {
            return { ok: false, error: "key in body must be a string." };
        }
        const bodyKey = input.body.key.trim();
        if (!bodyKey) {
            return { ok: false, error: "key in body must be a non-empty string." };
        }
        if (bodyKey !== key) {
            return { ok: false, error: "key in body must match route key." };
        }
    }

    if (!Object.hasOwn(input.body, "value")) {
        return { ok: false, error: "value is required." };
    }

    try {
        const updated = await input.keyValues.update(input.ctx, key, input.body.value);
        if (!updated) {
            return { ok: false, error: "Entry not found." };
        }
        return {
            ok: true,
            entry: {
                key: updated.key,
                value: updated.value,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update key-value entry.";
        return { ok: false, error: message };
    }
}
