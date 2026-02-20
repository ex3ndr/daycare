import { createId } from "@paralleldrive/cuid2";
import type { Config, SessionPermissions } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Writes an agent descriptor into SQLite storage.
 * Expects: descriptor has been validated.
 * Resolves user ownership as existing agent userId -> provided userId -> owner -> new owner.
 */
export async function agentDescriptorWrite(
    storageOrConfig: Storage | Config,
    agentId: string,
    descriptor: AgentDescriptor,
    userId?: string,
    defaultPermissions?: SessionPermissions
): Promise<void> {
    const storage = storageResolve(storageOrConfig);
    const existing = await storage.agents.findById(agentId);
    // Preserve existing ownership when present, otherwise resolve from caller/owner fallback chain.
    let resolvedUserId = existing?.userId ?? userId;
    if (!resolvedUserId) {
        const users = await storage.users.findMany();
        const owner = users.find((entry) => entry.isOwner) ?? users[0];
        if (owner) {
            resolvedUserId = owner.id;
        } else {
            resolvedUserId = createId();
            const now = Date.now();
            await storage.users.create({
                id: resolvedUserId,
                isOwner: true,
                createdAt: now,
                updatedAt: now
            });
        }
    }
    const now = Date.now();
    const nextPermissions =
        existing?.permissions ?? defaultPermissions ?? configDefaultPermissionsResolve(storageOrConfig);
    await storage.agents.create({
        id: agentId,
        userId: resolvedUserId,
        type: descriptor.type,
        descriptor,
        activeSessionId: existing?.activeSessionId ?? null,
        permissions: nextPermissions,
        tokens: existing?.tokens ?? null,
        stats: existing?.stats ?? {},
        lifecycle: existing?.lifecycle ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
    });
}

function configDefaultPermissionsResolve(storageOrConfig: Storage | Config): SessionPermissions {
    if (configIs(storageOrConfig)) {
        return storageOrConfig.defaultPermissions;
    }
    throw new Error("defaultPermissions is required when writing a new descriptor with Storage");
}

function configIs(value: Storage | Config): value is Config {
    if (!("defaultPermissions" in value)) {
        return false;
    }
    const permissions = value.defaultPermissions as SessionPermissions | undefined;
    return (
        !!permissions &&
        typeof permissions.workingDir === "string" &&
        Array.isArray(permissions.writeDirs) &&
        Array.isArray(permissions.readDirs) &&
        typeof permissions.network === "boolean" &&
        typeof permissions.events === "boolean"
    );
}
