import type { Storage } from "../../storage/storage.js";

const SYSTEM_WORKSPACE_ID = "system";
const SYSTEM_WORKSPACE_NAMETAG = "##system##";

/**
 * Ensures the reserved ownerless `##system##` workspace exists for engine startup.
 * Expects: migrations are applied and no conflicting user occupies the reserved id or nametag.
 */
export async function workspaceSystemEnsure(input: { storage: Pick<Storage, "users"> }): Promise<void> {
    const existing = await input.storage.users.findByNametag(SYSTEM_WORKSPACE_NAMETAG);
    if (existing) {
        workspaceSystemValidate(existing);
        return;
    }

    const conflicting = await input.storage.users.findById(SYSTEM_WORKSPACE_ID);
    if (conflicting) {
        throw new Error("The reserved system id is occupied by another user.");
    }

    try {
        await input.storage.users.create({
            id: SYSTEM_WORKSPACE_ID,
            isWorkspace: true,
            nametag: SYSTEM_WORKSPACE_NAMETAG,
            firstName: "System",
            lastName: "Workspace",
            bio: "Internal superuser workspace.",
            about: "Ownerless workspace bootstrapped automatically at engine startup.",
            emoji: "❌",
            memory: false,
            configuration: {
                homeReady: true,
                appReady: true
            }
        });
    } catch {
        const recovered = await input.storage.users.findByNametag(SYSTEM_WORKSPACE_NAMETAG);
        if (recovered) {
            workspaceSystemValidate(recovered);
            return;
        }
        const occupied = await input.storage.users.findById(SYSTEM_WORKSPACE_ID);
        if (occupied) {
            throw new Error("The reserved system id is occupied by another user.");
        }
        throw new Error("Failed to ensure system workspace.");
    }
}

function workspaceSystemValidate(user: { id: string; isWorkspace: boolean; workspaceOwnerId: string | null }): void {
    if (user.id !== SYSTEM_WORKSPACE_ID) {
        throw new Error('The reserved system workspace must use id "system".');
    }
    if (!user.isWorkspace) {
        throw new Error("The reserved system nametag is occupied by a non-workspace user.");
    }
    if (user.workspaceOwnerId !== null) {
        throw new Error("The reserved system workspace must not have an owner.");
    }
}
