import type { Context } from "@/types";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { type SwarmsUsersRuntime, swarmsSecretScopeResolve } from "./swarmsSecretScopeResolve.js";

export type SwarmsSecretsCopyInput = {
    ctx: Context;
    nametag: string;
    body: Record<string, unknown>;
    users: SwarmsUsersRuntime;
    secrets: SecretsRuntime;
};

export type SwarmsSecretsCopyResult =
    | {
          ok: true;
          swarmUserId: string;
          secret: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Copies one owner secret to the target swarm secret store.
 * Expects: body.secret is a non-empty secret name.
 */
export async function swarmsSecretsCopy(input: SwarmsSecretsCopyInput): Promise<SwarmsSecretsCopyResult> {
    const scope = await swarmsSecretScopeResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users
    });
    if (!scope.ok) {
        return scope;
    }

    const requestedName = secretNameParse(input.body.secret);
    if (!requestedName.ok) {
        return requestedName;
    }

    const ownerSecrets = await input.secrets.list(input.ctx);
    const ownerSecretsByName = new Map(ownerSecrets.map((secret) => [secret.name, secret]));
    const secret = ownerSecretsByName.get(requestedName.value);
    if (!secret) {
        return { ok: false, error: `Secret not found: "${requestedName.value}".` };
    }
    await input.secrets.add(scope.swarmCtx, {
        name: secret.name,
        displayName: secret.displayName,
        description: secret.description,
        variables: { ...secret.variables }
    });

    return {
        ok: true,
        swarmUserId: scope.swarmUserId,
        secret: requestedName.value
    };
}

function secretNameParse(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
    if (typeof input !== "string") {
        return { ok: false, error: "secret must be a string." };
    }
    const name = input.trim();
    if (!name) {
        return { ok: false, error: "secret is required." };
    }
    return { ok: true, value: name };
}
