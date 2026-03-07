import type { UsersRepository } from "../../storage/usersRepository.js";

export type AppWorkspaceResolveResult = {
    workspaceUserId: string;
    strippedPathname: string;
};

/**
 * Resolves workspace context from a /w/{userId}/... URL prefix.
 * Returns the workspace userId and stripped pathname, or null if not a /w/ route.
 * Throws if the user cannot be found or access is denied.
 *
 * Expects: callerUserId is the authenticated user from the JWT.
 */
export async function appWorkspaceResolve(
    pathname: string,
    callerUserId: string,
    users: UsersRepository
): Promise<AppWorkspaceResolveResult | null> {
    // Check for /w/{userId}/... prefix
    const match = pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
    if (!match) {
        return null;
    }

    const workspaceId = decodeURIComponent(match[1] ?? "").trim();
    if (!workspaceId) {
        return null;
    }

    const strippedPathname = match[2] ?? "/";

    // Caller accessing their own workspace
    if (workspaceId === callerUserId) {
        return { workspaceUserId: workspaceId, strippedPathname };
    }

    // Resolve target user by id
    const target = await users.findById(workspaceId);
    if (!target) {
        throw new WorkspaceAccessError("Workspace not found.");
    }

    // Caller accessing a child workspace they own
    if (target.isWorkspace && target.parentUserId === callerUserId) {
        return { workspaceUserId: target.id, strippedPathname };
    }

    throw new WorkspaceAccessError("Workspace access denied.");
}

export class WorkspaceAccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WorkspaceAccessError";
    }
}
