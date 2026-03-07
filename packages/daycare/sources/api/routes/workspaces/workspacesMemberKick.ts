import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";
import { workspacesAccessResolve } from "./workspacesAccessResolve.js";

export type WorkspacesMemberKickInput = {
    ctx: Context;
    nametag: string;
    userId: string;
    body: Record<string, unknown>;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "kick" | "isMember">;
};

export type WorkspacesMemberKickResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Removes an active member from a workspace and records the kick reason.
 * Expects: caller owns the workspace; target user id is non-empty.
 */
export async function workspacesMemberKick(input: WorkspacesMemberKickInput): Promise<WorkspacesMemberKickResult> {
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
        return { ok: false, error: "Only workspace owners can manage workspace members." };
    }

    const targetUserId = input.userId.trim();
    if (!targetUserId) {
        return { ok: false, error: "userId is required." };
    }
    if (targetUserId === input.ctx.userId) {
        return { ok: false, error: "Owner cannot remove themselves from the workspace." };
    }

    await input.workspaceMembers.kick(scope.workspace.id, targetUserId, bodyReasonParse(input.body.reason));
    return { ok: true };
}

function bodyReasonParse(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    return normalized || null;
}
