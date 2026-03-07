import type { Context } from "@/types";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SecretsUpdateResult, secretsUpdate } from "../secrets/secretsUpdate.js";
import { type WorkspacesUsersRuntime, workspacesSecretScopeResolve } from "./workspacesSecretScopeResolve.js";

export type WorkspacesSecretsUpdateInput = {
    ctx: Context;
    nametag: string;
    name: string;
    body: Record<string, unknown>;
    users: WorkspacesUsersRuntime;
    secrets: SecretsRuntime;
};

export type WorkspacesSecretsUpdateResult = SecretsUpdateResult;

/**
 * Updates an existing secret in a caller-owned workspace scope.
 * Expects: route name identifies the target secret in workspace scope.
 */
export async function workspacesSecretsUpdate(
    input: WorkspacesSecretsUpdateInput
): Promise<WorkspacesSecretsUpdateResult> {
    const scope = await workspacesSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    return secretsUpdate({
        ctx: scope.workspaceCtx,
        name: input.name,
        body: input.body,
        secrets: input.secrets
    });
}
