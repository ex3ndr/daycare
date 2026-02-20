import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Loads history records for the active session.
 * Expects: records are ordered chronologically from oldest to newest.
 */
export async function agentHistoryLoad(
    storageOrConfig: Storage | Config,
    agentId: string
): Promise<AgentHistoryRecord[]> {
    const storage = storageResolve(storageOrConfig);
    const agent = await storage.agents.findById(agentId);
    if (!agent?.activeSessionId) {
        return [];
    }
    return storage.history.findBySessionId(agent.activeSessionId);
}
