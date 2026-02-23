import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentState } from "./agentTypes.js";

/**
 * Writes agent state to SQLite storage.
 * Expects: descriptor has been persisted before state writes.
 */
export async function agentStateWrite(
    storageOrConfig: Storage | Config,
    ctxOrAgentId: Context | string,
    state: AgentState
): Promise<void> {
    const storage = storageResolve(storageOrConfig);
    const agentId = typeof ctxOrAgentId === "string" ? ctxOrAgentId : ctxOrAgentId.agentId;
    const existing = await storage.agents.findById(agentId);
    if (!existing) {
        throw new Error(`Agent descriptor missing for state write: ${agentId}`);
    }

    await storage.agents.update(agentId, {
        activeSessionId: state.activeSessionId ?? existing.activeSessionId ?? null,
        permissions: state.permissions,
        tokens: state.tokens,
        stats: state.stats,
        lifecycle: state.state,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt
    });
}
