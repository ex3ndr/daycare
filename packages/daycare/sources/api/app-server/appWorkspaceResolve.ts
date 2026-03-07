import type { UsersRepository } from "../../storage/usersRepository.js";

export type AppWorkspaceResolveResult = {
    workspaceUserId: string;
    strippedPathname: string;
};

/**
 * Resolves workspace context from a /w/{nametag}/... URL prefix.
 * Returns the workspace userId and stripped pathname, or null if not a /w/ route.
 * Throws if the nametag cannot be resolved or access is denied.
 *
 * Expects: callerUserId is the authenticated user from the JWT.
 */
export async function appWorkspaceResolve(
    pathname: string,
    callerUserId: string,
    users: UsersRepository
): Promise<AppWorkspaceResolveResult | null> {
    // Check for /w/{nametag}/... prefix
    const match = pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
    if (!match) {
        return null;
    }

    const nametag = decodeURIComponent(match[1] ?? "").trim();
    if (!nametag) {
        return null;
    }

    const strippedPathname = match[2] ?? "/";

    // Resolve target user by nametag
    const target = await users.findByNametag(nametag);
    if (!target) {
        throw new WorkspaceAccessError("Workspace not found.");
    }

    // Caller accessing their own workspace
    if (target.id === callerUserId) {
        return { workspaceUserId: target.id, strippedPathname };
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
