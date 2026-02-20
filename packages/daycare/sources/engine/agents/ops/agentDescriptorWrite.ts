import { createId } from "@paralleldrive/cuid2";
import type { Config } from "@/types";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { agentDbWrite } from "../../../storage/agentDbWrite.js";
import { userDbList } from "../../../storage/userDbList.js";
import { userDbWrite } from "../../../storage/userDbWrite.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Writes an agent descriptor into SQLite storage.
 * Expects: descriptor has been validated.
 * Resolves user ownership as existing agent userId -> provided userId -> owner -> new owner.
 */
export async function agentDescriptorWrite(
    config: Config,
    agentId: string,
    descriptor: AgentDescriptor,
    userId?: string
): Promise<void> {
    const existing = await agentDbRead(config, agentId);
    // Preserve existing ownership when present, otherwise resolve from caller/owner fallback chain.
    let resolvedUserId = existing?.userId ?? userId;
    if (!resolvedUserId) {
        const users = await userDbList(config);
        const owner = users.find((entry) => entry.isOwner) ?? users[0];
        if (owner) {
            resolvedUserId = owner.id;
        } else {
            resolvedUserId = createId();
            const now = Date.now();
            await userDbWrite(config, {
                id: resolvedUserId,
                isOwner: true,
                createdAt: now,
                updatedAt: now
            });
        }
    }
    const now = Date.now();
    await agentDbWrite(config, {
        id: agentId,
        userId: resolvedUserId,
        type: descriptor.type,
        descriptor,
        activeSessionId: existing?.activeSessionId ?? null,
        permissions: existing?.permissions ?? config.defaultPermissions,
        tokens: existing?.tokens ?? null,
        stats: existing?.stats ?? {},
        lifecycle: existing?.lifecycle ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
    });
}
