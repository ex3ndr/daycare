import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";

type WorkspaceUserRecord = NonNullable<Awaited<ReturnType<UsersRepository["findById"]>>>;

export type WorkspacesAccessResolveInput = {
    ctx: Context;
    nametag: string;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "isMember">;
};

export type WorkspacesAccessResolveResult =
    | {
          ok: true;
          workspace: WorkspaceUserRecord;
          callerRole: "owner" | "member";
      }
    | {
          ok: false;
          error: string;
          statusCode: number;
      };

/**
 * Resolves a workspace by nametag and checks whether the caller owns or joined it.
 * Expects: ctx carries the authenticated caller and nametag targets a workspace user.
 */
export async function workspacesAccessResolve(
    input: WorkspacesAccessResolveInput
): Promise<WorkspacesAccessResolveResult> {
    const normalizedNametag = input.nametag.trim();
    if (!normalizedNametag) {
        return { ok: false, error: "nametag is required.", statusCode: 400 };
    }

    const caller = await input.users.findById(input.ctx.userId);
    if (!caller) {
        return { ok: false, error: "Workspace access denied.", statusCode: 403 };
    }

    const workspace = await input.users.findByNametag(normalizedNametag);
    if (!workspace?.isWorkspace) {
        return { ok: false, error: "Workspace not found.", statusCode: 404 };
    }

    if (workspace.parentUserId === caller.id) {
        return {
            ok: true,
            workspace,
            callerRole: "owner"
        };
    }

    if (await input.workspaceMembers.isMember(workspace.id, caller.id)) {
        return {
            ok: true,
            workspace,
            callerRole: "member"
        };
    }

    return { ok: false, error: "Workspace access denied.", statusCode: 403 };
}
