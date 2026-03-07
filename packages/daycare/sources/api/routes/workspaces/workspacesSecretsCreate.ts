import type { Context } from "@/types";
import { type SecretsCreateResult, secretsCreate } from "../secrets/secretsCreate.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type WorkspacesUsersRuntime, workspacesSecretScopeResolve } from "./workspacesSecretScopeResolve.js";

export type WorkspacesSecretsCreateInput = {
    ctx: Context;
    nametag: string;
    body: Record<string, unknown>;
    users: WorkspacesUsersRuntime;
    secrets: SecretsRuntime;
};

export type WorkspacesSecretsCreateResult = SecretsCreateResult;

/**
 * Creates a secret in a caller-owned workspace scope.
 * Expects: body matches the base secrets create contract.
 */
export async function workspacesSecretsCreate(
    input: WorkspacesSecretsCreateInput
): Promise<WorkspacesSecretsCreateResult> {
    const scope = await workspacesSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsCreate({
        ctx: scope.workspaceCtx,
        body: input.body,
        secrets: input.secrets
    });
}
