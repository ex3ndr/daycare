import type { Context } from "@/types";
import { contextForUser } from "../../../engine/agents/context.js";

export type WorkspacesUsersRuntime = {
    findById: (id: string) => Promise<{ id: string; isOwner: boolean } | null>;
    findByNametag: (
        nametag: string
    ) => Promise<{ id: string; isWorkspace: boolean; parentUserId: string | null } | null>;
};

export type WorkspacesSecretScopeResolveInput = {
    ctx: Context;
    nametag: string;
    users: WorkspacesUsersRuntime;
};

export type WorkspacesSecretScopeResolveResult =
    | {
          ok: true;
          workspaceUserId: string;
          workspaceCtx: Context;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Resolves a workspace scope by nametag for owner-only workspace secret management routes.
 * Expects: caller is the owner and target nametag belongs to their workspace user.
 */
export async function workspacesSecretScopeResolve(
    input: WorkspacesSecretScopeResolveInput
): Promise<WorkspacesSecretScopeResolveResult> {
    const normalizedNametag = input.nametag.trim();
    if (!normalizedNametag) {
        return { ok: false, error: "nametag is required." };
    }

    const caller = await input.users.findById(input.ctx.userId);
    if (!caller?.isOwner) {
        return { ok: false, error: "Only the owner user can manage workspace secrets." };
    }

    const workspace = await input.users.findByNametag(normalizedNametag);
    if (!workspace || !workspace.isWorkspace || workspace.parentUserId !== caller.id) {
        return { ok: false, error: "Workspace not found." };
    }

    return {
        ok: true,
        workspaceUserId: workspace.id,
        workspaceCtx: contextForUser({ userId: workspace.id })
    };
}
