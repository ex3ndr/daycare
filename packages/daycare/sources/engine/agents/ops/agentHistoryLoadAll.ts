import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Loads persisted history stream for one agent.
 * Expects: records are returned in chronological order across sessions.
 * When limit is provided, returns at most that many records (oldest first).
 */
export async function agentHistoryLoadAll(
    storageOrConfig: Storage | Config,
    ctxOrAgentId: Context | string,
    limit?: number
): Promise<AgentHistoryRecord[]> {
    const storage = storageResolve(storageOrConfig);
    const agentId = typeof ctxOrAgentId === "string" ? ctxOrAgentId : ctxOrAgentId.agentId;
    return storage.history.findByAgentId(agentId, limit);
}
