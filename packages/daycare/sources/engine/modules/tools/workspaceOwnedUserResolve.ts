import type { UserWithConnectorKeysDbRecord } from "../../../storage/databaseTypes.js";
import type { ToolExecutionContext } from "./types.js";

export type WorkspaceOwnedUserResolveInput = {
    toolContext: ToolExecutionContext;
    userId: string;
    ownerError: string;
};

/**
 * Resolves a workspace user id owned by the calling user.
 * Expects: target user is a workspace child of the caller.
 */
export async function workspaceOwnedUserResolve(
    input: WorkspaceOwnedUserResolveInput
): Promise<UserWithConnectorKeysDbRecord> {
    const targetUserId = input.userId.trim();
    if (!targetUserId) {
        throw new Error("userId is required.");
    }

    const target = await input.toolContext.agentSystem.storage.users.findById(targetUserId);
    if (!target || !target.isWorkspace) {
        throw new Error(`Workspace not found: ${targetUserId}`);
    }
    if (target.parentUserId !== input.toolContext.ctx.userId) {
        throw new Error(input.ownerError);
    }

    return target;
}
