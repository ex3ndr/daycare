import type { Context, SessionPermissions } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import {
    TOPO_EVENT_TYPES,
    TOPO_SOURCE_AGENTS,
    topographyObservationEmit
} from "../../observations/topographyEvents.js";
import { agentDescriptorLabel } from "./agentDescriptorLabel.js";
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
): Promise<void> {
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

    const label = agentDescriptorLabel(descriptor);
    const parentAgentId = descriptorParentAgentIdResolve(descriptor);
    const scopeIds = parentAgentId ? [ctx.userId, parentAgentId] : [ctx.userId];
    if (existing) {
        await topographyObservationEmit(storage.observationLog, {
            userId: ctx.userId,
            type: TOPO_EVENT_TYPES.AGENT_UPDATED,
            source: TOPO_SOURCE_AGENTS,
            message: `Agent updated: ${label}`,
            details: `Agent ${ctx.agentId} descriptor updated to type ${descriptor.type}, label "${label}"`,
            data: {
                agentId: ctx.agentId,
                userId: ctx.userId,
                descriptorType: descriptor.type,
                label
            },
            scopeIds
        });
        return;
    }
    await topographyObservationEmit(storage.observationLog, {
        userId: ctx.userId,
        type: TOPO_EVENT_TYPES.AGENT_CREATED,
        source: TOPO_SOURCE_AGENTS,
        message: `Agent created: ${label}`,
        details: `Agent ${ctx.agentId} created with descriptor type ${descriptor.type}, label "${label}", for user ${ctx.userId}`,
        data: {
            agentId: ctx.agentId,
            userId: ctx.userId,
            descriptorType: descriptor.type,
            label,
            ...(parentAgentId ? { parentAgentId } : {})
        },
        scopeIds
    });
}

function descriptorParentAgentIdResolve(descriptor: AgentDescriptor): string | undefined {
    if ("parentAgentId" in descriptor) {
        const parent = descriptor.parentAgentId?.trim();
        if (parent) {
            return parent;
        }
    }
    return undefined;
}
