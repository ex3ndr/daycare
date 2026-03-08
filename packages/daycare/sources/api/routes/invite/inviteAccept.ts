import type { Context } from "@/types";
import { workspaceInviteTokenVerify } from "../../../engine/workspaces/workspaceInviteTokenVerify.js";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";

export type InviteAcceptInput = {
    ctx: Context;
    body: Record<string, unknown>;
    users: UsersRepository;
    workspaceMembers: Pick<WorkspaceMembersRepository, "add" | "isKicked" | "isMember">;
    secret: string;
};

export type InviteAcceptResult =
    | {
          ok: true;
          workspaceId: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Accepts a workspace invite for the authenticated caller.
 * Expects: body.token is a workspace invite JWT issued by the current server.
 */
export async function inviteAccept(input: InviteAcceptInput): Promise<InviteAcceptResult> {
    const token = typeof input.body.token === "string" ? input.body.token.trim() : "";
    if (!token) {
        return { ok: false, error: "token is required." };
    }

    let workspaceId = "";
    try {
        workspaceId = (await workspaceInviteTokenVerify(token, input.secret)).workspaceId;
    } catch {
        return { ok: false, error: "Invite link expired or invalid." };
    }

    const workspace = await input.users.findById(workspaceId);
    if (!workspace?.isWorkspace) {
        return { ok: false, error: "Workspace not found." };
    }

    if (workspace.workspaceOwnerId === input.ctx.userId || workspace.id === input.ctx.userId) {
        return { ok: true, workspaceId: workspace.id };
    }

    if (await input.workspaceMembers.isKicked(workspace.id, input.ctx.userId)) {
        return { ok: false, error: "You have been removed from this workspace." };
    }

    if (await input.workspaceMembers.isMember(workspace.id, input.ctx.userId)) {
        return { ok: true, workspaceId: workspace.id };
    }

    await input.workspaceMembers.add(workspace.id, input.ctx.userId);
    return { ok: true, workspaceId: workspace.id };
}
