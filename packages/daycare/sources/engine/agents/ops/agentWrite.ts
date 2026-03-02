import type { AgentConfig, AgentPath, Context, SessionPermissions } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import {
    TOPO_EVENT_TYPES,
    TOPO_SOURCE_AGENTS,
    topographyObservationEmit
} from "../../observations/topographyEvents.js";

/**
 * Writes an agent identity/config pair to storage.
 * Expects: ctx is authoritative for user/agent ownership.
 */
export async function agentWrite(
    storage: Storage,
    ctx: Context,
    path: AgentPath,
    config: AgentConfig,
    defaultPermissions: SessionPermissions
): Promise<void> {
    const existing = await storage.agents.findById(ctx.agentId);
    if (existing && existing.userId !== ctx.userId) {
        throw new Error(`Agent belongs to another user: ${ctx.agentId}`);
    }
    const kind = config.kind ?? "agent";
    const modelRole = config.modelRole === undefined ? modelRoleForKind(kind) : config.modelRole;
    const connectorName = config.connectorName ?? null;
    const parentAgentId = config.parentAgentId ?? null;
    const now = Date.now();
    const nextPermissions = existing?.permissions ?? defaultPermissions;
    await storage.agents.create({
        id: ctx.agentId,
        userId: ctx.userId,
        path,
        kind,
        modelRole,
        connectorName,
        parentAgentId,
        foreground: config.foreground,
        name: config.name,
        description: config.description,
        systemPrompt: config.systemPrompt,
        workspaceDir: config.workspaceDir,
        nextSubIndex: existing?.nextSubIndex ?? 0,
        activeSessionId: existing?.activeSessionId ?? null,
        permissions: nextPermissions,
        lifecycle: existing?.lifecycle ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
    });

    const label = agentLabelResolve(config);
    const scopeIds = parentAgentId ? [ctx.userId, parentAgentId] : [ctx.userId];
    const pathKind = kind;
    if (existing) {
        await topographyObservationEmit(storage.observationLog, {
            userId: ctx.userId,
            type: TOPO_EVENT_TYPES.AGENT_UPDATED,
            source: TOPO_SOURCE_AGENTS,
            message: `Agent updated: ${label}`,
            details: `Agent ${ctx.agentId} updated to path kind ${pathKind}, label "${label}"`,
            data: {
                agentId: ctx.agentId,
                userId: ctx.userId,
                pathKind,
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
        details: `Agent ${ctx.agentId} created with path kind ${pathKind}, label "${label}", for user ${ctx.userId}`,
        data: {
            agentId: ctx.agentId,
            userId: ctx.userId,
            pathKind,
            label,
            ...(parentAgentId ? { parentAgentId } : {})
        },
        scopeIds
    });
}

function agentLabelResolve(config: AgentConfig): string {
    if (config.kind === "connector") {
        return "user";
    }
    if (config.kind === "cron") {
        return config.name?.trim() || "cron task";
    }
    if (config.kind === "task") {
        return `task ${config.name?.trim() || "task"}`;
    }
    if (config.kind === "memory") {
        return "memory-agent";
    }
    if (config.kind === "search") {
        return config.name?.trim() || "memory-search";
    }
    if (config.kind === "sub") {
        return config.name?.trim() || "subagent";
    }
    return config.name?.trim() || "agent";
}

function modelRoleForKind(kind: NonNullable<AgentConfig["kind"]>): AgentConfig["modelRole"] {
    if (kind === "connector" || kind === "agent" || kind === "subuser" || kind === "swarm") {
        return "user";
    }
    if (kind === "sub") {
        return "subagent";
    }
    if (kind === "memory") {
        return "memory";
    }
    if (kind === "search") {
        return "memorySearch";
    }
    if (kind === "task") {
        return "task";
    }
    return null;
}
