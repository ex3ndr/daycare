import type { Storage } from "../../storage/storage.js";

const SYSTEM_WORKSPACE_NAMETAG = "system";

/**
 * Ensures the reserved ownerless `system` workspace exists for engine startup.
 * Expects: migrations are applied and no non-workspace user occupies the `system` nametag.
 */
export async function workspaceSystemEnsure(input: { storage: Pick<Storage, "users"> }): Promise<void> {
    const existing = await input.storage.users.findByNametag(SYSTEM_WORKSPACE_NAMETAG);
    if (existing) {
        workspaceSystemValidate(existing);
        return;
    }

    try {
        await input.storage.users.create({
            isWorkspace: true,
            nametag: SYSTEM_WORKSPACE_NAMETAG,
            firstName: "System",
            lastName: "Workspace",
            bio: "Internal superuser workspace.",
            about: "Ownerless workspace bootstrapped automatically at engine startup.",
            systemPrompt: "You are the Daycare system workspace. Act as the internal superuser workspace.",
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
        throw new Error("Failed to ensure system workspace.");
    }
}

function workspaceSystemValidate(user: { isWorkspace: boolean; workspaceOwnerId: string | null }): void {
    if (!user.isWorkspace) {
        throw new Error("The reserved system nametag is occupied by a non-workspace user.");
    }
    if (user.workspaceOwnerId !== null) {
        throw new Error("The reserved system workspace must not have an owner.");
    }
}
