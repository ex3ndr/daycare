import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentHistoryAppendRecord } from "./agentTypes.js";

/**
 * Appends a history record to the active session.
 * Expects: target agent exists.
 */
export async function agentHistoryAppend(
    storageOrConfig: Storage | Config,
    ctx: Context,
    record: AgentHistoryAppendRecord
): Promise<void> {
    const storage = storageResolve(storageOrConfig);
    await storage.appendHistory(ctx.agentId, record);
}
