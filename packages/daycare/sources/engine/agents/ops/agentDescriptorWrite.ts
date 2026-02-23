import type { Context, SessionPermissions } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Writes an agent descriptor into SQLite storage.
 * Expects: descriptor has been validated.
 * Uses ctx as the authoritative user/agent identity.
 */
export async function agentDescriptorWrite(
    storage: Storage,
    ctx: Context,
    descriptor: AgentDescriptor,
    defaultPermissions: SessionPermissions
): Promise<void>;
export async function agentDescriptorWrite(
    storage: Storage,
    agentId: string,
    descriptor: AgentDescriptor,
    userId: string,
    defaultPermissions: SessionPermissions
): Promise<void>;
export async function agentDescriptorWrite(
    storage: Storage,
    ctxOrAgentId: Context | string,
    descriptor: AgentDescriptor,
    userIdOrDefaultPermissions: string | SessionPermissions,
    maybeDefaultPermissions?: SessionPermissions
): Promise<void> {
    const ctx =
        typeof ctxOrAgentId === "string"
            ? { agentId: ctxOrAgentId, userId: userIdOrDefaultPermissions as string }
            : ctxOrAgentId;
    const defaultPermissions =
        typeof userIdOrDefaultPermissions === "string"
            ? (maybeDefaultPermissions as SessionPermissions)
            : userIdOrDefaultPermissions;
    const existing = await storage.agents.findById(ctx.agentId);
    if (existing && existing.userId !== ctx.userId) {
        throw new Error(`Agent belongs to another user: ${ctx.agentId}`);
    }
    const now = Date.now();
    const nextPermissions = existing?.permissions ?? defaultPermissions;
    await storage.agents.create({
        id: ctx.agentId,
        userId: ctx.userId,
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
