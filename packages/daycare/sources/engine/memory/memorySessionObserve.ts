import type { AgentHistoryRecord } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { Context } from "../agents/context.js";

const logger = getLogger("engine.memory");

/**
 * Observes a single invalidated session for memory extraction.
 * Stub for now — actual LLM-based extraction will be added later.
 *
 * Expects: ctx identifies the agent, records are the unprocessed history entries.
 */
export async function memorySessionObserve(
    sessionNumber: number,
    ctx: Context,
    records: AgentHistoryRecord[],
    _storage: Storage
): Promise<void> {
    logger.debug(
        `event: Observing session sessionNumber=${sessionNumber} agentId=${ctx.agentId} records=${records.length} (stub)`
    );
}
