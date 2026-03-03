import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";

export type KvCreateInput = {
    ctx: Context;
    body: Record<string, unknown>;
    keyValues: KeyValuesRepository;
};

export type KvCreateResult =
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
 * Creates a new key-value entry for the authenticated user.
 * Expects: body contains key:string and value:any (including null).
 */
export async function kvCreate(input: KvCreateInput): Promise<KvCreateResult> {
    const key = typeof input.body.key === "string" ? input.body.key.trim() : "";
    if (!key) {
        return { ok: false, error: "key is required." };
    }
    if (!Object.hasOwn(input.body, "value")) {
        return { ok: false, error: "value is required." };
    }

    try {
        const entry = await input.keyValues.create(input.ctx, {
            key,
            value: input.body.value
        });
        return {
            ok: true,
            entry: {
                key: entry.key,
                value: entry.value,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create key-value entry.";
        return { ok: false, error: message };
    }
}
