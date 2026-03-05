import type { Context } from "@/types";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SecretsUpdateResult, secretsUpdate } from "../secrets/secretsUpdate.js";
import { type SwarmsUsersRuntime, swarmsSecretScopeResolve } from "./swarmsSecretScopeResolve.js";

export type SwarmsSecretsUpdateInput = {
    ctx: Context;
    nametag: string;
    name: string;
    body: Record<string, unknown>;
    users: SwarmsUsersRuntime;
    secrets: SecretsRuntime;
};

export type SwarmsSecretsUpdateResult = SecretsUpdateResult;

/**
 * Updates an existing secret in a caller-owned swarm scope.
 * Expects: route name identifies the target secret in swarm scope.
 */
export async function swarmsSecretsUpdate(input: SwarmsSecretsUpdateInput): Promise<SwarmsSecretsUpdateResult> {
    const scope = await swarmsSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsUpdate({
        ctx: scope.swarmCtx,
        name: input.name,
        body: input.body,
        secrets: input.secrets
    });
}
