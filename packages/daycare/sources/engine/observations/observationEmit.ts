import { createId } from "@paralleldrive/cuid2";
import type { ObservationLogDbRecord } from "@/types";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";

export type ObservationEmitInput = {
    userId: string;
    type: string;
    source: string;
    message: string;
    details?: string | null;
    data?: unknown;
    scopeIds?: string[];
};

/**
 * Emits an observation to the log with auto-generated ID and timestamp.
 * Thin convenience wrapper over ObservationLogRepository.append.
 */
export async function observationEmit(
    repository: ObservationLogRepository,
    input: ObservationEmitInput
): Promise<ObservationLogDbRecord> {
    const record: ObservationLogDbRecord = {
        id: createId(),
        userId: input.userId,
        type: input.type,
        source: input.source,
        message: input.message,
        details: input.details ?? null,
        data: input.data ?? null,
        scopeIds: input.scopeIds ?? [],
        createdAt: Date.now()
    };
    await repository.append(record);
    return record;
}
