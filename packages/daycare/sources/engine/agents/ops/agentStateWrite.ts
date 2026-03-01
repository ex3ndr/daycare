import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import {
    TOPO_EVENT_TYPES,
    TOPO_SOURCE_AGENTS,
    topographyObservationEmit
} from "../../observations/topographyEvents.js";
import { agentDescriptorLabel } from "./agentDescriptorLabel.js";
import type { AgentState } from "./agentTypes.js";

/**
 * Writes agent state to SQLite storage.
 * Expects: descriptor has been persisted before state writes.
 */
export async function agentStateWrite(
    storageOrConfig: Storage | Config,
    ctx: Context,
    state: AgentState
): Promise<void> {
    const storage = storageResolve(storageOrConfig);
    const existing = await storage.agents.findById(ctx.agentId);
    if (!existing) {
        throw new Error(`Agent descriptor missing for state write: ${ctx.agentId}`);
    }

    await storage.agents.update(ctx.agentId, {
        activeSessionId: state.activeSessionId ?? existing.activeSessionId ?? null,
        permissions: state.permissions,
        tokens: state.tokens,
        stats: state.stats,
        lifecycle: state.state,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt
    });

    if (existing.lifecycle === state.state) {
        return;
    }
    const label = agentDescriptorLabel(existing.descriptor);
    const parentAgentId = "parentAgentId" in existing.descriptor ? existing.descriptor.parentAgentId : undefined;
    const scopeIds = parentAgentId ? [ctx.userId, parentAgentId] : [ctx.userId];
    await topographyObservationEmit(storage.observationLog, {
        userId: ctx.userId,
        type: TOPO_EVENT_TYPES.AGENT_LIFECYCLE,
        source: TOPO_SOURCE_AGENTS,
        message: `Agent ${state.state}: ${label}`,
        details: `Agent ${ctx.agentId} lifecycle changed to ${state.state}`,
        data: {
            agentId: ctx.agentId,
            userId: ctx.userId,
            lifecycle: state.state,
            label
        },
        scopeIds
    });
}
