import type { Context } from "@/types";
import { secretsPublicSummaryBuild } from "../secrets/secretsPublicSummaryBuild.js";
import type { SecretPublicSummary, SecretsRuntime } from "../secrets/secretsTypes.js";
import { type WorkspacesUsersRuntime, workspacesSecretScopeResolve } from "./workspacesSecretScopeResolve.js";

export type WorkspacesSecretsListInput = {
    ctx: Context;
    nametag: string;
    users: WorkspacesUsersRuntime;
    secrets: SecretsRuntime;
};

export type WorkspacesSecretsListResult =
    | {
          ok: true;
          secrets: SecretPublicSummary[];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Lists secret metadata for a workspace identified by nametag.
 * Expects: caller is owner and target nametag resolves to caller-owned workspace.
 */
export async function workspacesSecretsList(input: WorkspacesSecretsListInput): Promise<WorkspacesSecretsListResult> {
    const scope = await workspacesSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    const all = await input.secrets.list(scope.workspaceCtx);
    const summaries = all
        .map((secret) => secretsPublicSummaryBuild(secret))
        .sort((left, right) => left.name.localeCompare(right.name));
    return { ok: true, secrets: summaries };
}
