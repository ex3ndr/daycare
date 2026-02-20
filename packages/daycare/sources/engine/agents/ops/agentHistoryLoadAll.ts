import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Loads the complete persisted history stream for one agent.
 * Expects: records are returned in chronological order across sessions.
 */
export async function agentHistoryLoadAll(
    storageOrConfig: Storage | Config,
    agentId: string
): Promise<AgentHistoryRecord[]> {
    const storage = storageResolve(storageOrConfig);
    return storage.history.findByAgentId(agentId);
}
