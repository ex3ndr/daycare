import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";
import { workspacesAccessResolve } from "./workspacesAccessResolve.js";

export type WorkspaceMemberListItem = {
    userId: string;
    nametag: string;
    firstName: string | null;
    lastName: string | null;
    joinedAt: number;
    isOwner: boolean;
};

export type WorkspacesMembersListInput = {
    ctx: Context;
    nametag: string;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "findByWorkspace" | "isMember">;
};

export type WorkspacesMembersListResult =
    | {
          ok: true;
          members: WorkspaceMemberListItem[];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Lists the owner and active members for an owned or joined workspace.
 * Expects: workspace nametag resolves to an accessible workspace.
 */
export async function workspacesMembersList(input: WorkspacesMembersListInput): Promise<WorkspacesMembersListResult> {
    const scope = await workspacesAccessResolve({
        ctx: input.ctx,
        nametag: input.nametag,
        users: input.users,
        workspaceMembers: input.workspaceMembers
    });
    if (!scope.ok) {
        return { ok: false, error: scope.error };
    }

    const ownerId = scope.workspace.parentUserId?.trim() ?? "";
    const owner = ownerId ? await input.users.findById(ownerId) : null;
    if (!owner) {
        return { ok: false, error: "Workspace not found." };
    }

    const activeMembers = await input.workspaceMembers.findByWorkspace(scope.workspace.id);
    const members: WorkspaceMemberListItem[] = [
        {
            userId: owner.id,
            nametag: owner.nametag,
            firstName: owner.firstName,
            lastName: owner.lastName,
            joinedAt: scope.workspace.createdAt,
            isOwner: true
        }
    ];

    for (const record of activeMembers) {
        if (record.userId === owner.id) {
            continue;
        }
        const user = await input.users.findById(record.userId);
        if (!user) {
            continue;
        }
        members.push({
            userId: user.id,
            nametag: user.nametag,
            firstName: user.firstName,
            lastName: user.lastName,
            joinedAt: record.joinedAt,
            isOwner: false
        });
    }

    return {
        ok: true,
        members
    };
}
