import type { Context, SessionPermissions } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import {
    TOPO_EVENT_TYPES,
    TOPO_SOURCE_AGENTS,
    topographyObservationEmit
} from "../../observations/topographyEvents.js";
import { agentConfigFromDescriptor } from "./agentConfigFromDescriptor.js";
import type { AgentConfig } from "./agentConfigTypes.js";
import { agentDescriptorLabel } from "./agentDescriptorLabel.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentPathMemory, agentPathSearch, agentPathSub } from "./agentPathBuild.js";
import { agentPathFromDescriptor } from "./agentPathFromDescriptor.js";
import type { AgentPath } from "./agentPathTypes.js";

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
    const nextPath = await descriptorPathResolve(storage, ctx, descriptor, existing, now);
    const nextConfig = descriptorConfigResolve(descriptor, existing?.config ?? null);
    await storage.agents.create({
        id: ctx.agentId,
        userId: ctx.userId,
        type: descriptor.type,
        descriptor,
        path: nextPath,
        config: nextConfig,
        nextSubIndex: existing?.nextSubIndex ?? 0,
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

async function descriptorPathResolve(
    storage: Storage,
    ctx: Context,
    descriptor: AgentDescriptor,
    existing: Awaited<ReturnType<Storage["agents"]["findById"]>>,
    now: number
): Promise<AgentPath> {
    if (existing?.path) {
        return existing.path;
    }

    if (descriptor.type === "subagent" || descriptor.type === "app" || descriptor.type === "memory-search") {
        const parent = await storage.agents.findById(descriptor.parentAgentId);
        if (parent) {
            const parentPath = parent.path ?? agentPathFromDescriptor(parent.descriptor, { userId: parent.userId });
            const parentIndex = parent.nextSubIndex ?? 0;
            await storage.agents.update(parent.id, {
                nextSubIndex: parentIndex + 1,
                updatedAt: now
            });
            if (descriptor.type === "memory-search") {
                return agentPathSearch(parentPath, parentIndex);
            }
            return agentPathSub(parentPath, parentIndex);
        }
    }

    if (descriptor.type === "memory-agent") {
        const source = await storage.agents.findById(descriptor.id);
        if (source) {
            const sourcePath = source.path ?? agentPathFromDescriptor(source.descriptor, { userId: source.userId });
            return agentPathMemory(sourcePath);
        }
    }

    return agentPathFromDescriptor(descriptor, { userId: ctx.userId });
}

function descriptorConfigResolve(descriptor: AgentDescriptor, existing: AgentConfig | null): AgentConfig | null {
    const derived = agentConfigFromDescriptor(descriptor);
    if (Object.keys(derived).length === 0) {
        return existing;
    }
    return derived;
}
