import type { Context } from "@/types";
import type { SecretsRuntime } from "./secretsTypes.js";

export type SecretsDeleteInput = {
    ctx: Context;
    name: string;
    secrets: SecretsRuntime;
};

export type SecretsDeleteResult =
    | {
          ok: true;
          deleted: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Removes a saved secret by name.
 * Expects: name is non-empty.
 */
export async function secretsDelete(input: SecretsDeleteInput): Promise<SecretsDeleteResult> {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
        return { ok: false, error: "name is required." };
    }

    const deleted = await input.secrets.remove(input.ctx, normalizedName);
    if (!deleted) {
        return { ok: false, error: "Secret not found." };
    }

    return {
        ok: true,
        deleted: true
    };
}
