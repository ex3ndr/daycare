import type { Context } from "@/types";
import { secretsPublicSummaryBuild } from "../secrets/secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SwarmsUsersRuntime, swarmsSecretScopeResolve } from "./swarmsSecretScopeResolve.js";

export type SwarmsSecretsListInput = {
    ctx: Context;
    nametag: string;
    users: SwarmsUsersRuntime;
    secrets: SecretsRuntime;
};

export type SwarmsSecretsListResult =
    | {
          ok: true;
          secrets: SecretPublicSummary[];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Lists secret metadata for a swarm identified by nametag.
 * Expects: caller is owner and target nametag resolves to caller-owned swarm.
 */
export async function swarmsSecretsList(input: SwarmsSecretsListInput): Promise<SwarmsSecretsListResult> {
    const scope = await swarmsSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    const all = await input.secrets.list(scope.swarmCtx);
    const summaries = all
        .map((secret) => secretsPublicSummaryBuild(secret))
        .sort((left, right) => left.name.localeCompare(right.name));
    return { ok: true, secrets: summaries };
}
