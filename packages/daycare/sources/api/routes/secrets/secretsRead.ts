import type { Context } from "@/types";
import { secretsPublicSummaryBuild } from "./secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "./secretsTypes.js";

export type SecretsReadInput = {
    ctx: Context;
    name: string;
    secrets: SecretsRuntime;
};

export type SecretsReadResult =
    | {
          ok: true;
          secret: SecretPublicSummary;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Reads one secret by name and returns metadata only.
 * Expects: name is a non-empty string.
 */
export async function secretsRead(input: SecretsReadInput): Promise<SecretsReadResult> {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
        return { ok: false, error: "name is required." };
    }

    const all = await input.secrets.list(input.ctx);
    const found = all.find((secret) => secret.name === normalizedName);
    if (!found) {
        return { ok: false, error: "Secret not found." };
    }

    return {
        ok: true,
        secret: secretsPublicSummaryBuild(found)
    };
}
