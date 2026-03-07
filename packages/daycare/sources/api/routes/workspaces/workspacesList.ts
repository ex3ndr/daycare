import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";

export type WorkspacesListItem = {
    nametag: string;
    userId: string;
    firstName: string | null;
    lastName: string | null;
    emoji: string | null;
    isSelf: boolean;
};

export type WorkspacesListInput = {
    ctx: Context;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "findByUser">;
};

export type WorkspacesListResult = {
    ok: true;
    workspaces: WorkspacesListItem[];
};

/**
 * Lists workspaces accessible to the authenticated user.
 * Returns the user's own workspace plus owned and joined workspaces.
 *
 * Expects: ctx carries the authenticated userId.
 */
export async function workspacesList(input: WorkspacesListInput): Promise<WorkspacesListResult> {
    const caller = await input.users.findById(input.ctx.userId);
    if (!caller) {
        return { ok: true, workspaces: [] };
    }

    const workspaces = new Map<string, WorkspacesListItem>();
    workspaces.set(caller.id, {
        nametag: caller.nametag,
        userId: caller.id,
        firstName: caller.firstName,
        lastName: caller.lastName,
        emoji: caller.emoji,
        isSelf: true
    });

    // Find child workspaces owned by this user
    const children = await input.users.findByParentUserId(caller.id);
    for (const child of children) {
        if (child.isWorkspace) {
            workspaces.set(child.id, {
                nametag: child.nametag,
                userId: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                emoji: child.emoji,
                isSelf: false
            });
        }
    }

    const memberships = await input.workspaceMembers.findByUser(caller.id);
    for (const membership of memberships) {
        const workspace = await input.users.findById(membership.workspaceId);
        if (!workspace?.isWorkspace || workspace.id === caller.id) {
            continue;
        }
        workspaces.set(workspace.id, {
            nametag: workspace.nametag,
            userId: workspace.id,
            firstName: workspace.firstName,
            lastName: workspace.lastName,
            emoji: workspace.emoji,
            isSelf: false
        });
    }

    return {
        ok: true,
        workspaces: Array.from(workspaces.values()).sort((left, right) => {
            if (left.isSelf !== right.isSelf) {
                return left.isSelf ? -1 : 1;
            }
            return left.nametag.localeCompare(right.nametag);
        })
    };
}
