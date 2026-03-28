import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { messageContentExtractText } from "../../messages/messageContentExtractText.js";
import { messageContentExtractToolCalls } from "../../messages/messageContentExtractToolCalls.js";
import { RLM_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";
import { rlmNoToolsExtract } from "../../modules/rlm/rlmNoToolsExtract.js";
import { agentHistoryRestoreBoundaryIs } from "./agentHistoryRestoreBoundaryIs.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

const PENDING_HISTORY_CHUNK_SIZE = 200;
const PENDING_HISTORY_TYPES: AgentHistoryRecord["type"][] = [
    "assistant_message",
    "assistant_rewrite",
    "rlm_start",
    "rlm_tool_call",
    "rlm_tool_result",
    "rlm_complete"
];

/**
 * Loads the minimal tail needed to resolve a pending run_python phase after restart.
 * Expects: only records at or after the latest assistant run_python turn are required.
 */
export async function agentHistoryPendingLoad(
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
    let foundRunPythonAssistant = false;

    while (true) {
        const chunk = await storage.history.findChunkBySessionId(agent.activeSessionId, {
            limit: PENDING_HISTORY_CHUNK_SIZE,
            beforeId,
            types: PENDING_HISTORY_TYPES
        });
        if (chunk.length === 0) {
            break;
        }

        const assistantBoundaryIndex = chunk.findIndex((row) => runPythonAssistantRecordIs(row.record));
        if (assistantBoundaryIndex >= 0) {
            rowsDesc.push(...chunk.slice(0, assistantBoundaryIndex + 1));
            foundRunPythonAssistant = true;
            break;
        }

        rowsDesc.push(...chunk);
        if (chunk.some((row) => agentHistoryRestoreBoundaryIs(row.record))) {
            break;
        }

        beforeId = chunk[chunk.length - 1]?.id ?? null;
    }

    if (!foundRunPythonAssistant) {
        return [];
    }

    return rowsDesc.reverse().map((row) => row.record);
}

function runPythonAssistantRecordIs(record: AgentHistoryRecord): boolean {
    if (record.type !== "assistant_message") {
        return false;
    }
    if (messageContentExtractToolCalls(record.content).some((toolCall) => toolCall.name === RLM_TOOL_NAME)) {
        return true;
    }
    const text = messageContentExtractText(record.content);
    return text ? rlmNoToolsExtract(text).length > 0 : false;
}
