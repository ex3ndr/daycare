import type { Context } from "@/types";
import { contextForUser } from "../../../engine/agents/context.js";

export type WorkspacesUsersRuntime = {
    findById: (id: string) => Promise<{ id: string } | null>;
    findByNametag: (
        nametag: string
    ) => Promise<{ id: string; isWorkspace: boolean; workspaceOwnerId: string | null } | null>;
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
 * Resolves a workspace scope by nametag for workspace-owner secret management routes.
 * Expects: caller owns the target workspace via workspaceOwnerId.
 */
export async function workspacesSecretScopeResolve(
    input: WorkspacesSecretScopeResolveInput
): Promise<WorkspacesSecretScopeResolveResult> {
    const normalizedNametag = input.nametag.trim();
    if (!normalizedNametag) {
        return { ok: false, error: "nametag is required." };
    }

    const caller = await input.users.findById(input.ctx.userId);
    if (!caller) {
        return { ok: false, error: "Only workspace owners can manage workspace secrets." };
    }

    const workspace = await input.users.findByNametag(normalizedNametag);
    if (!workspace || !workspace.isWorkspace) {
        return { ok: false, error: "Workspace not found." };
    }
    if (workspace.workspaceOwnerId !== caller.id) {
        return { ok: false, error: "Only workspace owners can manage workspace secrets." };
    }

    return {
        ok: true,
        workspaceUserId: workspace.id,
        workspaceCtx: contextForUser({ userId: workspace.id })
    };
}
