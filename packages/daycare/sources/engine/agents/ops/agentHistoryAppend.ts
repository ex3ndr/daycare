import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

/**
 * Appends a history record to the active session.
 * Expects: target agent exists.
 */
export async function agentHistoryAppend(
    storageOrConfig: Storage | Config,
    agentId: string,
    record: AgentHistoryRecord
): Promise<void> {
    const storage = storageResolve(storageOrConfig);
    await storage.appendHistory(agentId, record);
}
