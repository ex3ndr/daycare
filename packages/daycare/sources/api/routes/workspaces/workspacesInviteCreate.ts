import type { Context } from "@/types";
import { workspaceInviteTokenCreate } from "../../../engine/workspaces/workspaceInviteTokenCreate.js";
import { workspaceInviteUrlBuild } from "../../../engine/workspaces/workspaceInviteUrlBuild.js";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";
import { workspacesAccessResolve } from "./workspacesAccessResolve.js";

export type WorkspacesInviteCreateInput = {
    ctx: Context;
    nametag: string;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "isMember">;
    publicEndpoints: {
        appEndpoint: string;
        serverEndpoint: string;
    };
    secret: string;
};

export type WorkspacesInviteCreateResult =
    | {
          ok: true;
          url: string;
          token: string;
          expiresAt: number;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Creates a reusable invite link for a workspace owner.
 * Expects: publicEndpoints describe the current app/api origins for the request.
 */
export async function workspacesInviteCreate(
    input: WorkspacesInviteCreateInput
): Promise<WorkspacesInviteCreateResult> {
    const scope = await workspacesAccessResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users,
        workspaceMembers: input.workspaceMembers
    });
    if (!scope.ok) {
        return { ok: false, error: scope.error };
    }
    if (scope.callerRole !== "owner") {
        return { ok: false, error: "Only workspace owners can create invite links." };
    }

    const link = await workspaceInviteTokenCreate({
        workspaceId: scope.workspace.id,
        secret: input.secret
    });

    return {
        ok: true,
        token: link.token,
        expiresAt: link.expiresAt,
        url: workspaceInviteUrlBuild({
            appEndpoint: input.publicEndpoints.appEndpoint,
            backendUrl: input.publicEndpoints.serverEndpoint,
            token: link.token,
            workspaceName: workspaceNameBuild(scope.workspace)
        })
    };
}

function workspaceNameBuild(workspace: { firstName: string | null; lastName: string | null; nametag: string }): string {
    const label = [workspace.firstName, workspace.lastName]
        .filter((value) => value?.trim())
        .join(" ")
        .trim();
    return label || workspace.nametag;
}
