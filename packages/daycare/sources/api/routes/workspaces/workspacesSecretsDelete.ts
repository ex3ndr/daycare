import type { Context } from "@/types";
import { type SecretsDeleteResult, secretsDelete } from "../secrets/secretsDelete.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type WorkspacesUsersRuntime, workspacesSecretScopeResolve } from "./workspacesSecretScopeResolve.js";

export type WorkspacesSecretsDeleteInput = {
    ctx: Context;
    nametag: string;
    name: string;
    users: WorkspacesUsersRuntime;
    secrets: SecretsRuntime;
};

export type WorkspacesSecretsDeleteResult = SecretsDeleteResult;

/**
 * Deletes one secret in a caller-owned workspace scope.
 * Expects: route name identifies an existing secret in workspace scope.
 */
export async function workspacesSecretsDelete(
    input: WorkspacesSecretsDeleteInput
): Promise<WorkspacesSecretsDeleteResult> {
    const scope = await workspacesSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsDelete({
        ctx: scope.workspaceCtx,
        name: input.name,
        secrets: input.secrets
    });
}
