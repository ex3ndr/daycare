import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";

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
};

export type WorkspacesListResult = {
    ok: true;
    workspaces: WorkspacesListItem[];
};

/**
 * Lists workspaces accessible to the authenticated user.
 * Returns the user's own workspace plus all child workspaces.
 *
 * Expects: ctx carries the authenticated owner userId.
 */
export async function workspacesList(input: WorkspacesListInput): Promise<WorkspacesListResult> {
    const caller = await input.users.findById(input.ctx.userId);
    if (!caller) {
        return { ok: true, workspaces: [] };
    }

    const workspaces: WorkspacesListItem[] = [
        {
            nametag: caller.nametag,
            userId: caller.id,
            firstName: caller.firstName,
            lastName: caller.lastName,
            emoji: caller.emoji,
            isSelf: true
        }
    ];

    // Find child workspaces owned by this user
    const children = await input.users.findByParentUserId(caller.id);
    for (const child of children) {
        if (child.isWorkspace) {
            workspaces.push({
                nametag: child.nametag,
                userId: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                emoji: child.emoji,
                isSelf: false
            });
        }
    }

    return { ok: true, workspaces };
}
