import type { Context } from "@/types";
import { type SecretsCreateResult, secretsCreate } from "../secrets/secretsCreate.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SwarmsUsersRuntime, swarmsSecretScopeResolve } from "./swarmsSecretScopeResolve.js";

export type SwarmsSecretsCreateInput = {
    ctx: Context;
    nametag: string;
    body: Record<string, unknown>;
    users: SwarmsUsersRuntime;
    secrets: SecretsRuntime;
};

export type SwarmsSecretsCreateResult = SecretsCreateResult;

/**
 * Creates a secret in a caller-owned swarm scope.
 * Expects: body matches the base secrets create contract.
 */
export async function swarmsSecretsCreate(input: SwarmsSecretsCreateInput): Promise<SwarmsSecretsCreateResult> {
    const scope = await swarmsSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsCreate({
        ctx: scope.swarmCtx,
        body: input.body,
        secrets: input.secrets
    });
}
