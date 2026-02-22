import type { AgentHistoryRecord } from "@/types";
import { getLogger } from "../../log.js";
import type { ProviderSettings } from "../../settings.js";
import type { Storage } from "../../storage/storage.js";
import type { Context } from "../agents/context.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { type InferObservation, inferObservations } from "./infer/inferObservations.js";

const logger = getLogger("engine.memory");

export type MemorySessionObserveOptions = {
    sessionNumber: number;
    ctx: Context;
    records: AgentHistoryRecord[];
    storage: Storage;
    inferenceRouter: InferenceRouter;
    providers: ProviderSettings[];
};

/**
 * Observes a single invalidated session for memory extraction.
 * Runs inference to extract observations from conversation history.
 *
 * Expects: ctx identifies the agent, records are the unprocessed history entries.
 */
export async function memorySessionObserve(options: MemorySessionObserveOptions): Promise<InferObservation[]> {
    const { sessionNumber, ctx, records, inferenceRouter, providers } = options;
    logger.debug(
        `event: Observing session sessionNumber=${sessionNumber} agentId=${ctx.agentId} records=${records.length}`
    );

    const observations = await inferObservations({
        records,
        inferenceRouter,
        providers
    });

    logger.debug(
        `event: Session observed sessionNumber=${sessionNumber} agentId=${ctx.agentId} observations=${observations.length}`
    );

    return observations;
}
