import type { Context } from "@/types";
import { secretsPublicSummaryBuild } from "./secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "./secretsTypes.js";

export type SecretsListInput = {
    ctx: Context;
    secrets: SecretsRuntime;
};

export type SecretsListResult = {
    ok: true;
    secrets: SecretPublicSummary[];
};

/**
 * Lists saved secrets as metadata only.
 * Expects: secrets runtime is available for the authenticated caller.
 */
export async function secretsList(input: SecretsListInput): Promise<SecretsListResult> {
    const all = await input.secrets.list(input.ctx);
    const summaries = all
        .map((secret) => secretsPublicSummaryBuild(secret))
        .sort((left, right) => left.name.localeCompare(right.name));
    return {
        ok: true,
        secrets: summaries
    };
}
