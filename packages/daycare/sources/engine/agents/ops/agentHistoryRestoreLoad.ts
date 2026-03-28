import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { agentHistoryRestoreBoundaryIs } from "./agentHistoryRestoreBoundaryIs.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

const RESTORE_HISTORY_CHUNK_SIZE = 500;
const RESTORE_HISTORY_TYPES: AgentHistoryRecord["type"][] = [
    "user_message",
    "assistant_message",
    "assistant_rewrite",
    "rlm_complete"
];

/**
 * Loads only the restore-relevant tail of the active session history.
 * Expects: active session rows are ordered by increasing id; older tool checkpoint rows are not needed here.
 */
export async function agentHistoryRestoreLoad(
    storageOrConfig: Storage | Config,
    ctx: Context
): Promise<AgentHistoryRecord[]> {
    const storage = storageResolve(storageOrConfig);
    const agent = await storage.agents.findById(ctx.agentId);
    if (!agent?.activeSessionId) {
        return [];
    }

    const rowsDesc: Array<{ id: number; record: AgentHistoryRecord }> = [];
    let beforeId: number | null = null;

    while (true) {
        const chunk = await storage.history.findChunkBySessionId(agent.activeSessionId, {
            limit: RESTORE_HISTORY_CHUNK_SIZE,
            beforeId,
            types: RESTORE_HISTORY_TYPES
        });
        if (chunk.length === 0) {
            break;
        }

        const boundaryIndex = chunk.findIndex((row) => agentHistoryRestoreBoundaryIs(row.record));
        if (boundaryIndex >= 0) {
            rowsDesc.push(...chunk.slice(0, boundaryIndex + 1));
            break;
        }

        rowsDesc.push(...chunk);
        beforeId = chunk[chunk.length - 1]?.id ?? null;
    }

    return rowsDesc.reverse().map((row) => row.record);
}
