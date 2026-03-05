import type { Context } from "@/types";
import { type SecretsDeleteResult, secretsDelete } from "../secrets/secretsDelete.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SwarmsUsersRuntime, swarmsSecretScopeResolve } from "./swarmsSecretScopeResolve.js";

export type SwarmsSecretsDeleteInput = {
    ctx: Context;
    nametag: string;
    name: string;
    users: SwarmsUsersRuntime;
    secrets: SecretsRuntime;
};

export type SwarmsSecretsDeleteResult = SecretsDeleteResult;

/**
 * Deletes one secret in a caller-owned swarm scope.
 * Expects: route name identifies an existing secret in swarm scope.
 */
export async function swarmsSecretsDelete(input: SwarmsSecretsDeleteInput): Promise<SwarmsSecretsDeleteResult> {
    const scope = await swarmsSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsDelete({
        ctx: scope.swarmCtx,
        name: input.name,
        secrets: input.secrets
    });
}
