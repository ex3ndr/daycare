import type { Context } from "@/types";
import { contextForUser } from "../../../engine/agents/context.js";

export type SwarmsUsersRuntime = {
    findById: (id: string) => Promise<{ id: string; isOwner: boolean } | null>;
    findByNametag: (nametag: string) => Promise<{ id: string; isSwarm: boolean; parentUserId: string | null } | null>;
};

export type SwarmsSecretScopeResolveInput = {
    ctx: Context;
    nametag: string;
    users: SwarmsUsersRuntime;
};

export type SwarmsSecretScopeResolveResult =
    | {
          ok: true;
          swarmUserId: string;
          swarmCtx: Context;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Resolves a swarm scope by nametag for owner-only swarm secret management routes.
 * Expects: caller is the owner and target nametag belongs to their swarm user.
 */
export async function swarmsSecretScopeResolve(
    input: SwarmsSecretScopeResolveInput
): Promise<SwarmsSecretScopeResolveResult> {
    const normalizedNametag = input.nametag.trim();
    if (!normalizedNametag) {
        return { ok: false, error: "nametag is required." };
    }

    const caller = await input.users.findById(input.ctx.userId);
    if (!caller?.isOwner) {
        return { ok: false, error: "Only the owner user can manage swarm secrets." };
    }

    const swarm = await input.users.findByNametag(normalizedNametag);
    if (!swarm || !swarm.isSwarm || swarm.parentUserId !== caller.id) {
        return { ok: false, error: "Swarm not found." };
    }

    return {
        ok: true,
        swarmUserId: swarm.id,
        swarmCtx: contextForUser({ userId: swarm.id })
    };
}
